# GitHub OIDC provider. There can only be one per URL in an account, and the account may be shared
# with other projects that already created it: in that case create_oidc_provider = false reads the
# existing one and leaves it untouched.
#
# No thumbprint_list: it is optional in the IAM API, and for GitHub AWS validates the certificate
# with its own library of trusted root CAs
# (https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateOpenIDConnectProvider.html).
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = "https://${local.github_oidc_host}"
  client_id_list = [local.github_audience]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1

  url = "https://${local.github_oidc_host}"

  lifecycle {
    postcondition {
      condition     = contains(self.client_id_list, local.github_audience)
      error_message = "The existing GitHub OIDC provider does not accept the audience sts.amazonaws.com. Add it to the provider (aws iam add-client-id-to-open-id-connect-provider) or ask whoever manages it."
    }
  }
}
