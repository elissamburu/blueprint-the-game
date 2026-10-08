# The site (bucket + CloudFront) and its budget. The certificate already exists in us-east-1 and is
# only referenced by ARN; the DNS of the domain is outside AWS (a CNAME to the distribution, see
# step 5 of docs/guias/configurar-aws-en-tu-fork.md). Neither is managed here.

module "site" {
  source = "../../modules/static-site"

  name_prefix         = var.name_prefix
  project_tag         = var.project_tag
  account_id          = var.account_id
  domain              = var.domain
  acm_certificate_arn = var.acm_certificate_arn
  price_class         = var.price_class
  auth_domain         = module.auth.auth_domain
}

# Login and the player profile (F4 MVP, ADR-0029).
module "auth" {
  source = "../../modules/auth"

  name_prefix        = var.name_prefix
  project_tag        = var.project_tag
  account_id         = var.account_id
  domain             = var.domain
  auth_domain_prefix = var.auth_domain_prefix

  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
}

module "observability" {
  source = "../../modules/observability"

  name_prefix  = var.name_prefix
  project_tag  = var.project_tag
  account_id   = var.account_id
  budget_usd   = var.budget_usd
  budget_email = var.budget_email
}
