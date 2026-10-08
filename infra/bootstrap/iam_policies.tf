# Policies of the three GitHub roles and their permissions boundary (ADR-0014, RNF-07).
#
# The account is shared with other projects, so every permission is scoped twice where AWS allows it:
#   - by ARN, with the name prefix (var.name_prefix);
#   - by the Project tag (var.project_tag), with aws:ResourceTag on existing resources and
#     aws:RequestTag on creation.
# Services and resource types without tag-based conditions are noted next to their statement.
#
# Only what F3 needs (S3 + CloudFront + ACM + Route 53 + Budgets) and the F4 MVP (Cognito user and
# identity pools, the profiles table and the player role, ADR-0029): later phases extend these
# policies and the boundary with a new bootstrap PR.

locals {
  project_tag_condition_key = "aws:ResourceTag/${local.project_tag_key}"
  request_tag_condition_key = "aws:RequestTag/${local.project_tag_key}"

  resource_is_project = { StringEquals = { (local.project_tag_condition_key) = var.project_tag } }
  request_is_project  = { StringEquals = { (local.request_tag_condition_key) = var.project_tag } }
  in_this_account     = { StringEquals = { "aws:ResourceAccount" = local.account } }

  route53_enabled         = var.route53_zone_id != ""
  route53_changes_enabled = local.route53_enabled && length(var.route53_record_names) > 0

  # CloudFront types without tags whose ARNs carry a generated ID (see locals.tf). Creating one does
  # not affect other projects, so it stays on "*"; updating and deleting are limited to the IDs of the
  # variables, and with an empty list nothing can be updated or deleted (the boundary denies it).
  cloudfront_untaggable_create_actions = [
    "cloudfront:CreateOriginAccessControl",
    "cloudfront:CreateResponseHeadersPolicy",
  ]
  cloudfront_untaggable = {
    OriginAccessControls = {
      actions = ["cloudfront:UpdateOriginAccessControl", "cloudfront:DeleteOriginAccessControl"]
      arns    = local.project_oac_arns
    }
    ResponseHeadersPolicies = {
      actions = ["cloudfront:UpdateResponseHeadersPolicy", "cloudfront:DeleteResponseHeadersPolicy"]
      arns    = local.project_response_headers_policy_arns
    }
  }
  # F4 (ADR-0029): the actions Terraform uses on the user pool (and its clients and domain, which
  # are authorized against the user pool), the identity pool and the profiles table. Every one of
  # them takes a resource type with aws:ResourceTag in the Service Authorization Reference
  # (cognito-idp: userpool; cognito-identity: identitypool; dynamodb: table).
  user_pool_read_actions = [
    "cognito-idp:DescribeUserPool",
    "cognito-idp:DescribeUserPoolClient",
    "cognito-idp:GetUserPoolMfaConfig",
    "cognito-idp:ListTagsForResource",
    "cognito-idp:DescribeIdentityProvider",
  ]
  user_pool_write_actions = [
    "cognito-idp:UpdateUserPool",
    "cognito-idp:DeleteUserPool",
    "cognito-idp:SetUserPoolMfaConfig",
    "cognito-idp:CreateUserPoolClient",
    "cognito-idp:UpdateUserPoolClient",
    "cognito-idp:DeleteUserPoolClient",
    "cognito-idp:CreateUserPoolDomain",
    "cognito-idp:UpdateUserPoolDomain",
    "cognito-idp:DeleteUserPoolDomain",
    # Sign-in with Google (ADR-0029): the identity provider of the user pool, authorized against
    # the userpool resource (Service Authorization Reference: no condition keys of their own).
    "cognito-idp:CreateIdentityProvider",
    "cognito-idp:UpdateIdentityProvider",
    "cognito-idp:DeleteIdentityProvider",
  ]
  identity_pool_read_actions = [
    "cognito-identity:DescribeIdentityPool",
    "cognito-identity:GetIdentityPoolRoles",
    "cognito-identity:ListTagsForResource",
  ]
  identity_pool_write_actions = [
    "cognito-identity:UpdateIdentityPool",
    "cognito-identity:DeleteIdentityPool",
  ]
  table_read_actions = [
    "dynamodb:DescribeTable",
    "dynamodb:DescribeContinuousBackups",
    "dynamodb:DescribeTimeToLive",
    "dynamodb:ListTagsOfResource",
  ]
  table_write_actions = [
    "dynamodb:UpdateTable",
    "dynamodb:DeleteTable",
    "dynamodb:UpdateContinuousBackups",
    "dynamodb:UpdateTimeToLive",
  ]

  cloudfront_untaggable_actions = flatten([for type in local.cloudfront_untaggable : type.actions])
  untaggable_arns               = flatten([for type in local.cloudfront_untaggable : type.arns])

  cloudfront_untaggable_allow = [
    for name, type in local.cloudfront_untaggable : {
      Sid      = "CloudFrontProject${name}"
      Effect   = "Allow"
      Action   = type.actions
      Resource = type.arns
    } if length(type.arns) > 0
  ]

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
      # F4 (ADR-0029). Explicit actions, no Get*/List*/Describe* wildcards: cognito-idp:List* and
      # Get* include reading users (ListUsers, AdminGetUser is Admin*), which no role needs.
      # Service Authorization Reference: DescribeUserPool, DescribeUserPoolClient,
      # GetUserPoolMfaConfig and ListTagsForResource take the userpool resource (aws:ResourceTag);
      # DescribeUserPoolDomain takes no resource, so it stays on "*".
      {
        Sid       = "UserPoolsRead"
        Effect    = "Allow"
        Action    = local.user_pool_read_actions
        Resource  = local.project_user_pool_arn
        Condition = local.resource_is_project
      },
      {
        Sid      = "UserPoolDomainsRead"
        Effect   = "Allow"
        Action   = "cognito-idp:DescribeUserPoolDomain"
        Resource = "*"
      },
      {
        Sid       = "IdentityPoolsRead"
        Effect    = "Allow"
        Action    = local.identity_pool_read_actions
        Resource  = local.project_identity_pool_arn
        Condition = local.resource_is_project
      },
      {
        Sid       = "TablesRead"
        Effect    = "Allow"
        Action    = local.table_read_actions
        Resource  = local.project_table_arn
        Condition = local.resource_is_project
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
      # Origin access controls and response headers policies have no tags: created on "*" (the
      # create actions take no resource), updated and deleted only by ID (cloudfront_untaggable_allow).
      # No other CloudFront type without tags (cache and origin request policies, origin access
      # identities...) is writable.
      {
        Sid      = "CloudFrontCreateUntaggable"
        Effect   = "Allow"
        Action   = local.cloudfront_untaggable_create_actions
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
      # iam:PermissionsBoundary is in the request context of every role action listed with it here
      # (CreateRole, DeleteRole, UpdateRole, UpdateRoleDescription, UpdateAssumeRolePolicy,
      # Attach/DetachRolePolicy, Put/DeleteRolePolicy, PutRolePermissionsBoundary), but not of
      # TagRole/UntagRole: Service Authorization Reference for IAM, action condition keys
      # (https://servicereference.us-east-1.amazonaws.com/v1/iam/iam.json). tests/ checks the lists.
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
          "iam:UpdateRoleDescription",
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
    ] : statement if local.route53_changes_enabled], local.cloudfront_untaggable_allow)
  })

  # --- Apply, F4 (ADR-0029): a managed policy of its own, attached to gh-apply, so the inline policy
  # stays under the 10,240 characters IAM allows per role.
  apply_auth_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # --- F4 (ADR-0029): login (Cognito) and the profiles table, with the same model: created with
      # the Project tag (aws:RequestTag) and changed only while they carry it (aws:ResourceTag).
      # CreateUserPool and CreateIdentityPool take no resource and support aws:RequestTag;
      # CreateTable takes the table, so it is also limited to the prefix.
      {
        Sid       = "AuthCreateTagged"
        Effect    = "Allow"
        Action    = ["cognito-idp:CreateUserPool", "cognito-identity:CreateIdentityPool"]
        Resource  = "*"
        Condition = local.request_is_project
      },
      {
        Sid       = "TablesCreateTagged"
        Effect    = "Allow"
        Action    = "dynamodb:CreateTable"
        Resource  = local.project_table_arn
        Condition = local.request_is_project
      },
      {
        Sid       = "AuthTagOnCreate"
        Effect    = "Allow"
        Action    = ["cognito-idp:TagResource", "cognito-identity:TagResource", "dynamodb:TagResource"]
        Resource  = [local.project_user_pool_arn, local.project_identity_pool_arn, local.project_table_arn]
        Condition = local.request_is_project
      },
      {
        Sid    = "AuthManageTagged"
        Effect = "Allow"
        Action = concat(
          local.user_pool_write_actions,
          local.identity_pool_write_actions,
          local.table_write_actions,
          local.auth_tag_actions,
          local.auth_untag_actions,
        )
        Resource  = [local.project_user_pool_arn, local.project_identity_pool_arn, local.project_table_arn]
        Condition = local.resource_is_project
      },
      # SetIdentityPoolRoles takes no resource type and no condition key (Service Authorization
      # Reference for cognito-identity): it cannot be scoped to the project's identity pool. The
      # role it sets is limited by iam:PassRole below; see the limits in the guide.
      {
        Sid      = "IdentityPoolRoles"
        Effect   = "Allow"
        Action   = "cognito-identity:SetIdentityPoolRoles"
        Resource = "*"
      },
      # Only the player role, and only to Cognito identity pools (iam:PassedToService is a condition
      # key of iam:PassRole in the Service Authorization Reference for IAM).
      {
        Sid       = "PassPlayerRole"
        Effect    = "Allow"
        Action    = "iam:PassRole"
        Resource  = local.player_role_arn
        Condition = { StringEquals = { "iam:PassedToService" = local.identity_pool_service } }
      },
    ]
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
  auth_arns = [local.project_user_pool_arn, local.project_identity_pool_arn, local.project_table_arn]
  # The same in the boundary, shorter: one pattern for the user pools and the identity pools
  # (cognito-idp:...:userpool/* and cognito-identity:...:identitypool/*). The boundary only grants
  # cognito-idp and cognito-identity actions, so the pattern matching other cognito-* services
  # grants nothing more.
  boundary_auth_arns = ["arn:${local.partition}:cognito-*:${var.aws_region}:${local.account}:*pool/*", local.project_table_arn]
  # No resource type (Service Authorization Reference): only "*".
  auth_unscoped_actions = ["cognito-idp:CreateUserPool", "cognito-idp:DescribeUserPoolDomain", "cognito-identity:CreateIdentityPool", "cognito-identity:SetIdentityPoolRoles"]
  auth_tag_actions      = ["cognito-idp:TagResource", "cognito-identity:TagResource", "dynamodb:TagResource"]
  auth_untag_actions    = ["cognito-idp:UntagResource", "cognito-identity:UntagResource", "dynamodb:UntagResource"]
  tag_actions = concat([
    "cloudfront:TagResource",
    "acm:AddTagsToCertificate",
    "budgets:TagResource",
    "iam:TagRole",
    "iam:TagPolicy",
  ], local.auth_tag_actions)
  # The F4 untag actions are not here: their ceiling (CeilingAuthTagged) already needs the Project
  # tag, which is what OnlyTaggedResources adds, and removing it is denied by KeepProjectTag.
  untag_actions = [
    "cloudfront:UntagResource",
    "acm:RemoveTagsFromCertificate",
    "budgets:UntagResource",
    "iam:UntagRole",
    "iam:UntagPolicy",
  ]

  boundary_policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Sid       = "CeilingS3"
        Effect    = "Allow"
        Action    = "s3:*"
        Resource  = [local.project_bucket_arn, local.project_object_arn]
        Condition = local.in_this_account
      },
      # Actions without a resource, reads, ACM and Route 53 (both scoped by the role policies), and
      # updating and deleting origin access controls and response headers policies, which
      # OnlyProjectUntaggable below limits to the IDs of the variables (with empty lists, to none).
      {
        Sid    = "CeilingAnyResource"
        Effect = "Allow"
        Action = concat(
          ["cloudfront:Get*", "cloudfront:Describe*", "cloudfront:List*", "cloudfront:CreateDistribution", "cloudfront:CreateFunction"],
          local.cloudfront_untaggable_create_actions,
          local.cloudfront_untaggable_actions,
          ["acm:*", "route53:Get*", "route53:List*", "route53:ChangeResourceRecordSets"],
          local.auth_unscoped_actions,
        )
        Resource = "*"
      },
      # Resources of the project by name (and by tag in the role policies). One statement: each
      # action only ever applies to resources of its own service, so the union of the actions on the
      # union of the ARNs allows the same as one statement per service, in fewer characters.
      # Creating the table and tagging the F4 resources go without the tag (there is none yet):
      # CreateWithProjectTag and the tag rules below apply. *Item (the ceiling of the player role)
      # matches Get, Put, Update, Delete, BatchGet, BatchWrite and ConditionCheck Item; the policy of
      # the role (infra/modules/auth) grants only the first four and Query.
      {
        Sid    = "CeilingProjectResources"
        Effect = "Allow"
        Action = concat(
          ["cloudfront:*", "budgets:*", "iam:*", "dynamodb:CreateTable"],
          local.auth_tag_actions,
          ["dynamodb:*Item", "dynamodb:Query"],
        )
        Resource = concat(
          [local.distribution_arn, local.project_function_arn, local.project_budget_arn, local.project_role_arn, local.project_policy_arn],
          local.boundary_auth_arns,
        )
      },
      # F4 (ADR-0029): no service wildcards. Suffix wildcards keep the boundary under the 6,144
      # characters of a managed policy; in the Service Authorization Reference each one matches only
      # these actions: *UserPool (Create, Delete, Describe, Update), *UserPoolClient and
      # *UserPoolDomain (Create, Delete, Describe, Update), *UserPoolMfaConfig (Get, Set),
      # *IdentityProvider (Create, Delete, Describe, Update; not ListIdentityProviders nor
      # GetIdentityProviderByIdentifier),
      # *IdentityPool (Create, Delete, Describe, Update), *ContinuousBackups and *TimeToLive
      # (Describe, Update), and *Table (Create, Delete, Describe, Update and Import Table, and
      # Create, Describe and Update GlobalTable). Every change needs the Project tag here
      # (aws:ResourceTag of the userpool, identitypool and table resource types), so the creates
      # never match this statement (a new resource has no tag yet; they are in CeilingAnyResource
      # and CeilingProjectResources), and the global table actions also need the global-table
      # resource, which is not in Resource: of *Table only Describe, Update and Delete remain.
      {
        Sid    = "CeilingAuthTagged"
        Effect = "Allow"
        Action = [
          "cognito-idp:*UserPool",
          "cognito-idp:*UserPoolClient",
          "cognito-idp:*UserPoolDomain",
          "cognito-idp:*UserPoolMfaConfig",
          "cognito-idp:*IdentityProvider",
          "cognito-idp:ListTagsForResource",
          "cognito-identity:*IdentityPool",
          "cognito-identity:GetIdentityPoolRoles",
          "cognito-identity:ListTagsForResource",
          "dynamodb:*Table",
          "dynamodb:*ContinuousBackups",
          "dynamodb:*TimeToLive",
          "dynamodb:ListTagsOfResource",
          "cognito-idp:UntagResource",
          "cognito-identity:UntagResource",
          "dynamodb:UntagResource",
        ]
        Resource  = local.boundary_auth_arns
        Condition = local.resource_is_project
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
          "iam:UpdateRoleDescription",
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
      # with aws:ResourceTag are listed; S3, Route 53 and budgets (ModifyBudget) are scoped by name in
      # the role policies instead, and origin access controls and response headers policies by ID
      # (OnlyProject* below).
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
          "iam:UpdateRoleDescription",
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
          "cognito-idp:CreateUserPool",
          "cognito-identity:CreateIdentityPool",
          "dynamodb:CreateTable",
        ]
        Resource  = "*"
        Condition = { StringNotEquals = { (local.request_tag_condition_key) = var.project_tag } }
      },
      # The Project tag cannot be removed, set to another value or put on another project's resource.
      {
        Sid       = "KeepProjectTag"
        Effect    = "Deny"
        Action    = concat(local.untag_actions, local.auth_untag_actions)
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
      ],
      # Origin access controls and response headers policies have no tags: only the IDs of the
      # variables can be updated or deleted. One NotResource list for both types: an ARN of one type
      # never matches an action of the other.
      [for arns in [local.untaggable_arns] : {
        Sid      = "OnlyProjectUntaggable"
        Effect   = "Deny"
        Action   = local.cloudfront_untaggable_actions
        Resource = "*"
      } if length(arns) == 0],
      [for arns in [local.untaggable_arns] : {
        Sid         = "OnlyProjectUntaggable"
        Effect      = "Deny"
        Action      = local.cloudfront_untaggable_actions
        NotResource = arns
      } if length(arns) > 0],
    )
  })
}
