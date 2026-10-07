# Policies of the three GitHub roles and their permissions boundary (ADR-0014, RNF-07).
#
# The account is shared with other projects, so every permission is scoped twice where AWS allows it:
#   - by ARN, with the name prefix (var.name_prefix);
#   - by the Project tag (var.project_tag), with aws:ResourceTag on existing resources and
#     aws:RequestTag on creation.
# Services and resource types without tag-based conditions are noted next to their statement.
#
# Only what F3 needs (S3 + CloudFront + ACM + Route 53 + Budgets): later phases extend these policies
# and the boundary with a new bootstrap PR.

locals {
  project_tag_condition_key = "aws:ResourceTag/${local.project_tag_key}"
  request_tag_condition_key = "aws:RequestTag/${local.project_tag_key}"

  resource_is_project = { StringEquals = { (local.project_tag_condition_key) = var.project_tag } }
  request_is_project  = { StringEquals = { (local.request_tag_condition_key) = var.project_tag } }
  in_this_account     = { StringEquals = { "aws:ResourceAccount" = local.account } }

  route53_enabled         = var.route53_zone_id != ""
  route53_changes_enabled = local.route53_enabled && length(var.route53_record_names) > 0

  # --- Read: what terraform plan needs to refresh the project's resources (gh-plan and gh-apply).
  read_statements = concat(
    [
      {
        Sid      = "StateList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = local.state_bucket_arn
      },
      {
        Sid      = "StateRead"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${local.state_bucket_arn}/*"
      },
      # Bucket-level reads only (the resource is the bucket ARN, so no s3:GetObject on site files).
      # S3 is scoped by bucket name and account, not by tag.
      {
        Sid       = "ProjectBucketsRead"
        Effect    = "Allow"
        Action    = ["s3:Get*", "s3:List*"]
        Resource  = local.project_bucket_arn
        Condition = local.in_this_account
      },
      # Read-only and not sensitive. Origin access controls and cache and response headers policies
      # have no tag-based conditions and their ARNs carry an ID, not a name, so reads stay on "*";
      # the List* actions do not support resource-level permissions either.
      {
        Sid      = "CloudFrontRead"
        Effect   = "Allow"
        Action   = ["cloudfront:Get*", "cloudfront:Describe*", "cloudfront:List*"]
        Resource = "*"
      },
      {
        Sid      = "CertificatesRead"
        Effect   = "Allow"
        Action   = ["acm:DescribeCertificate", "acm:GetCertificate", "acm:ListTagsForCertificate"]
        Resource = local.certificate_arn
      },
      {
        Sid      = "CertificatesList"
        Effect   = "Allow"
        Action   = "acm:ListCertificates"
        Resource = "*"
      },
      {
        Sid      = "BudgetsRead"
        Effect   = "Allow"
        Action   = ["budgets:ViewBudget", "budgets:ListTagsForResource"]
        Resource = local.project_budget_arn
      },
      {
        Sid    = "IamRead"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:ListRoleTags",
          "iam:ListInstanceProfilesForRole",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicyVersions",
          "iam:ListPolicyTags",
        ]
        Resource = [local.project_role_arn, local.project_policy_arn]
      },
    ],
    # Route 53 has no tag-based conditions: access is limited to one hosted zone.
    [for statement in [
      {
        Sid      = "HostedZoneRead"
        Effect   = "Allow"
        Action   = ["route53:GetHostedZone", "route53:ListResourceRecordSets", "route53:ListTagsForResource"]
        Resource = local.hosted_zone_arn
      },
      {
        Sid      = "Route53Changes"
        Effect   = "Allow"
        Action   = "route53:GetChange"
        Resource = "arn:${local.partition}:route53:::change/*"
      },
      {
        Sid      = "HostedZonesList"
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones", "route53:ListHostedZonesByName"]
        Resource = "*"
      },
    ] : statement if local.route53_enabled],
  )

  plan_policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(local.read_statements, [
      # use_lockfile: plan takes the lock too.
      {
        Sid      = "StateLock"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${local.state_bucket_arn}/*.tflock"
      },
    ])
  })

  # --- Apply: create and change the project's resources.
  apply_policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(local.read_statements, [
      {
        Sid      = "StateWrite"
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${local.state_bucket_arn}/*"
      },
      {
        Sid      = "StateUnlock"
        Effect   = "Allow"
        Action   = "s3:DeleteObject"
        Resource = "${local.state_bucket_arn}/*.tflock"
      },
      # S3 by bucket name and account (not by tag). The boundary keeps the state bucket out of reach.
      {
        Sid       = "ProjectBuckets"
        Effect    = "Allow"
        Action    = "s3:*"
        Resource  = [local.project_bucket_arn, local.project_object_arn]
        Condition = local.in_this_account
      },
      # CloudFront distributions and functions support tags: created with the Project tag...
      {
        Sid       = "CloudFrontCreateTagged"
        Effect    = "Allow"
        Action    = ["cloudfront:CreateDistribution", "cloudfront:CreateFunction"]
        Resource  = "*"
        Condition = local.request_is_project
      },
      {
        Sid       = "CloudFrontTagOnCreate"
        Effect    = "Allow"
        Action    = "cloudfront:TagResource"
        Resource  = [local.distribution_arn, local.project_function_arn]
        Condition = local.request_is_project
      },
      # ...and changed only while they carry it.
      {
        Sid       = "CloudFrontManageTagged"
        Effect    = "Allow"
        Action    = "cloudfront:*"
        Resource  = [local.distribution_arn, local.project_function_arn]
        Condition = local.resource_is_project
      },
      # Origin access controls and response headers policies have no tags and their ARNs carry a
      # generated ID: they cannot be scoped to the project. The boundary allows nothing else.
      {
        Sid    = "CloudFrontUntaggable"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:UpdateOriginAccessControl",
          "cloudfront:DeleteOriginAccessControl",
          "cloudfront:CreateResponseHeadersPolicy",
          "cloudfront:UpdateResponseHeadersPolicy",
          "cloudfront:DeleteResponseHeadersPolicy",
        ]
        Resource = "*"
      },
      # ACM supports tags on certificates (in us-east-1, the region CloudFront reads them from).
      {
        Sid       = "CertificatesRequestTagged"
        Effect    = "Allow"
        Action    = "acm:RequestCertificate"
        Resource  = "*"
        Condition = local.request_is_project
      },
      {
        Sid       = "CertificatesTagOnCreate"
        Effect    = "Allow"
        Action    = "acm:AddTagsToCertificate"
        Resource  = local.certificate_arn
        Condition = local.request_is_project
      },
      {
        Sid       = "CertificatesManageTagged"
        Effect    = "Allow"
        Action    = "acm:*"
        Resource  = local.certificate_arn
        Condition = local.resource_is_project
      },
      # Budgets: ModifyBudget also creates the budget and takes no tag condition, so budgets are
      # scoped by name; tagging follows the same rules as the other services.
      {
        Sid      = "Budgets"
        Effect   = "Allow"
        Action   = ["budgets:ModifyBudget", "budgets:ViewBudget"]
        Resource = local.project_budget_arn
      },
      {
        Sid       = "BudgetsTagOnCreate"
        Effect    = "Allow"
        Action    = "budgets:TagResource"
        Resource  = local.project_budget_arn
        Condition = local.request_is_project
      },
      {
        Sid       = "BudgetsManageTags"
        Effect    = "Allow"
        Action    = ["budgets:TagResource", "budgets:UntagResource"]
        Resource  = local.project_budget_arn
        Condition = local.resource_is_project
      },
      # IAM: roles and policies of the project, always with the boundary (the boundary enforces it
      # again with explicit denies). No iam:PassRole until a phase needs it.
      {
        Sid      = "RolesCreate"
        Effect   = "Allow"
        Action   = "iam:CreateRole"
        Resource = local.project_role_arn
        Condition = {
          StringEquals = {
            "iam:PermissionsBoundary"         = local.boundary_arn
            (local.request_tag_condition_key) = var.project_tag
          }
        }
      },
      {
        Sid    = "RolesManage"
        Effect = "Allow"
        Action = [
          "iam:DeleteRole",
          "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:PutRolePermissionsBoundary",
        ]
        Resource = local.project_role_arn
        Condition = {
          StringEquals = {
            "iam:PermissionsBoundary"         = local.boundary_arn
            (local.project_tag_condition_key) = var.project_tag
          }
        }
      },
      {
        Sid       = "RolesTagOnCreate"
        Effect    = "Allow"
        Action    = "iam:TagRole"
        Resource  = local.project_role_arn
        Condition = local.request_is_project
      },
      {
        Sid       = "RolesManageTags"
        Effect    = "Allow"
        Action    = ["iam:TagRole", "iam:UntagRole"]
        Resource  = local.project_role_arn
        Condition = local.resource_is_project
      },
      {
        Sid       = "PoliciesCreate"
        Effect    = "Allow"
        Action    = ["iam:CreatePolicy", "iam:TagPolicy"]
        Resource  = local.project_policy_arn
        Condition = local.request_is_project
      },
      {
        Sid    = "PoliciesManage"
        Effect = "Allow"
        Action = [
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:SetDefaultPolicyVersion",
          "iam:DeletePolicy",
          "iam:TagPolicy",
          "iam:UntagPolicy",
        ]
        Resource  = local.project_policy_arn
        Condition = local.resource_is_project
      },
      ], [for statement in [
        # Route 53 has no tag-based conditions: changes are limited to the listed record names and to
        # the record types of the site (A/AAAA aliases and the CNAME of the ACM validation).
        {
          Sid      = "SiteRecords"
          Effect   = "Allow"
          Action   = "route53:ChangeResourceRecordSets"
          Resource = local.hosted_zone_arn
          Condition = {
            "ForAllValues:StringLike" = {
              "route53:ChangeResourceRecordSetsNormalizedRecordNames" = var.route53_record_names
            }
            "ForAllValues:StringEquals" = {
              "route53:ChangeResourceRecordSetsRecordTypes" = ["A", "AAAA", "CNAME"]
            }
          }
        },
    ] : statement if local.route53_changes_enabled])
  })

  # --- Deploy of the site: upload files and invalidate the cache (ADR-0014). The bucket and the
  # distribution are created by infra/envs/prod, after the bootstrap, so they are matched by name
  # prefix (S3, no tags) and by Project tag (CloudFront).
  deploy_content_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "SiteBucketList"
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = local.project_bucket_arn
        Condition = local.in_this_account
      },
      {
        Sid       = "SiteFiles"
        Effect    = "Allow"
        Action    = ["s3:PutObject", "s3:DeleteObject"]
        Resource  = local.project_object_arn
        Condition = local.in_this_account
      },
      # The state bucket shares the prefix: never writable from here.
      {
        Sid      = "NoState"
        Effect   = "Deny"
        Action   = "s3:*"
        Resource = [local.state_bucket_arn, "${local.state_bucket_arn}/*"]
      },
      {
        Sid       = "Invalidate"
        Effect    = "Allow"
        Action    = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation", "cloudfront:ListInvalidations"]
        Resource  = local.distribution_arn
        Condition = local.resource_is_project
      },
    ]
  })

  # --- Permissions boundary of the three roles and of every role they create. It is the ceiling:
  # nothing outside these Allow statements is possible, whatever policy a role gets.
  tag_actions = [
    "cloudfront:TagResource",
    "acm:AddTagsToCertificate",
    "budgets:TagResource",
    "iam:TagRole",
    "iam:TagPolicy",
  ]
  untag_actions = [
    "cloudfront:UntagResource",
    "acm:RemoveTagsFromCertificate",
    "budgets:UntagResource",
    "iam:UntagRole",
    "iam:UntagPolicy",
  ]

  boundary_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CeilingS3"
        Effect    = "Allow"
        Action    = "s3:*"
        Resource  = [local.project_bucket_arn, local.project_object_arn]
        Condition = local.in_this_account
      },
      {
        Sid      = "CeilingServices"
        Effect   = "Allow"
        Action   = ["cloudfront:*", "acm:*", "route53:Get*", "route53:List*", "route53:ChangeResourceRecordSets"]
        Resource = "*"
      },
      {
        Sid      = "CeilingBudgets"
        Effect   = "Allow"
        Action   = "budgets:*"
        Resource = local.project_budget_arn
      },
      {
        Sid      = "CeilingIam"
        Effect   = "Allow"
        Action   = "iam:*"
        Resource = [local.project_role_arn, local.project_policy_arn]
      },
      # The state bucket: objects only (state and lock files); never its configuration or history.
      {
        Sid       = "ProtectState"
        Effect    = "Deny"
        NotAction = ["s3:Get*", "s3:List*", "s3:PutObject", "s3:DeleteObject"]
        Resource  = [local.state_bucket_arn, "${local.state_bucket_arn}/*"]
      },
      # The bootstrap's roles and boundary are read-only for every role (including gh-apply).
      {
        Sid       = "ProtectBootstrap"
        Effect    = "Deny"
        NotAction = ["iam:Get*", "iam:List*"]
        Resource  = [local.bootstrap_role_arn, local.bootstrap_policy_arn]
      },
      # No role can be created or changed without this same boundary, and no boundary can be removed.
      {
        Sid    = "RolesNeedBoundary"
        Effect = "Deny"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:PutRolePermissionsBoundary",
        ]
        Resource  = "*"
        Condition = { StringNotEquals = { "iam:PermissionsBoundary" = local.boundary_arn } }
      },
      {
        Sid      = "KeepBoundary"
        Effect   = "Deny"
        Action   = "iam:DeleteRolePermissionsBoundary"
        Resource = "*"
      },
      # Existing resources without the Project tag cannot be changed. Only actions on resource types
      # with aws:ResourceTag are listed; S3, Route 53, budgets (ModifyBudget), origin access controls
      # and response headers policies are scoped by name or ID in the role policies instead.
      {
        Sid    = "OnlyTaggedResources"
        Effect = "Deny"
        Action = concat([
          "cloudfront:UpdateDistribution",
          "cloudfront:DeleteDistribution",
          "cloudfront:CreateInvalidation",
          "cloudfront:UpdateFunction",
          "cloudfront:PublishFunction",
          "cloudfront:DeleteFunction",
          "acm:DeleteCertificate",
          "acm:UpdateCertificateOptions",
          "acm:RenewCertificate",
          "acm:ExportCertificate",
          "acm:ResendValidationEmail",
          "acm:RevokeCertificate",
          "iam:DeleteRole",
          "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:PutRolePermissionsBoundary",
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:SetDefaultPolicyVersion",
          "iam:DeletePolicy",
        ], local.untag_actions)
        Resource  = "*"
        Condition = { StringNotEquals = { (local.project_tag_condition_key) = var.project_tag } }
      },
      # New resources of tag-capable types are born with the Project tag.
      {
        Sid    = "CreateWithProjectTag"
        Effect = "Deny"
        Action = [
          "cloudfront:CreateDistribution",
          "cloudfront:CreateFunction",
          "acm:RequestCertificate",
          "iam:CreateRole",
          "iam:CreatePolicy",
        ]
        Resource  = "*"
        Condition = { StringNotEquals = { (local.request_tag_condition_key) = var.project_tag } }
      },
      # The Project tag cannot be removed, set to another value or put on another project's resource.
      {
        Sid       = "KeepProjectTag"
        Effect    = "Deny"
        Action    = local.untag_actions
        Resource  = "*"
        Condition = { "ForAnyValue:StringEquals" = { "aws:TagKeys" = [local.project_tag_key] } }
      },
      {
        Sid      = "NoOtherProjectTag"
        Effect   = "Deny"
        Action   = local.tag_actions
        Resource = "*"
        Condition = {
          StringNotEquals = { (local.request_tag_condition_key) = var.project_tag }
          Null            = { (local.request_tag_condition_key) = "false" }
        }
      },
      {
        Sid      = "NoOtherProjectResources"
        Effect   = "Deny"
        Action   = local.tag_actions
        Resource = "*"
        Condition = {
          StringNotEquals = { (local.project_tag_condition_key) = var.project_tag }
          Null            = { (local.project_tag_condition_key) = "false" }
        }
      },
    ]
  })
}
