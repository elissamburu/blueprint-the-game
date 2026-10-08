# Monthly cost budget of the project (ADR-0014, RNF-05). The account may be shared, so it counts only
# the costs tagged Project = project_tag. A budget can only filter by an ACTIVE cost allocation tag:
# activate Project in Billing and Cost Management → Cost allocation tags (step 3.2 of
# docs/guias/configurar-aws-en-tu-fork.md). Until then the budget exists but counts nothing.
# Filter format "user:<key>$<value>" (Budget filters:
# https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create-filters.html; example
# in https://docs.aws.amazon.com/cli/latest/reference/budgets/create-budget.html).

resource "aws_budgets_budget" "monthly" {
  name         = "${var.name_prefix}-mensual"
  account_id   = var.account_id
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = tostring(var.budget_usd)
  limit_unit   = "USD"
  tags         = { Project = var.project_tag }

  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:Project$%s", var.project_tag)]
  }

  # Same alerts as the manual beta: 80 % of the actual cost and 100 % of the forecast.
  notification {
    notification_type          = "ACTUAL"
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.budget_email]
  }

  notification {
    notification_type          = "FORECASTED"
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.budget_email]
  }
}
