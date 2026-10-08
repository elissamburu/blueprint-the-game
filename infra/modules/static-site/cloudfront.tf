# CloudFront in front of the private bucket: origin access control, the rewrite of the game routes,
# security headers and the managed cache policy (the same setup the manual beta had).

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name_prefix}-site"
  description                       = "CloudFront signs the requests to the site bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Viewer request: every path without a file extension gets /index.html, so reloading a route of the
# game works. The code lives in tools/deploy-site, with its tests and the preview server that runs
# it (pnpm --filter @blueprint/tools-deploy-site test): one copy, not two.
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${var.name_prefix}-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Serves /index.html on the game routes (paths without a file extension)"
  code    = file("${path.module}/../../../tools/deploy-site/cloudfront/spa-rewrite.js")
  publish = true
  tags    = local.tags
}

# The headers of the managed SecurityHeadersPolicy that the beta uses, with the same values and the
# same "override origin" settings (Use managed response headers policies:
# https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-response-headers-policies.html#managed-response-headers-policies-security).
# A policy of its own so the Content-Security-Policy can be added later (#44); not yet.
resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.name_prefix}-security-headers"
  comment = "Security headers of the site (those of the managed SecurityHeadersPolicy; no CSP yet)"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = false
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "SAMEORIGIN"
      override     = false
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = false
    }

    xss_protection {
      protection = true
      mode_block = true
      override   = false
    }
  }
}

# Managed by AWS and only read: the roles cannot write cache policies. CachingOptimized keeps the
# cache key minimal, compresses with Gzip and Brotli and honors the Cache-Control of each object
# (Use managed cache policies:
# https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html#managed-cache-caching-optimized).
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_distribution" "site" {
  comment             = "${var.name_prefix}: game site"
  enabled             = true
  aliases             = [var.domain]
  default_root_object = "index.html"
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = var.price_class
  tags                = local.tags

  origin {
    origin_id                = local.origin_id
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # The documentation lists the policies available with sni-only and recommends none in particular.
  # TLSv1.2_2025 is the newest one that still accepts TLS 1.2 clients (TLSv1.3_2025 accepts only
  # TLS 1.3); compared with TLSv1.2_2021, the one of the beta, it drops the CHACHA20 ciphers and the
  # SHA-224 signature schemes (Distribution settings, Security policy, and Supported protocols and
  # ciphers between viewers and CloudFront:
  # https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesGeneral.html#DownloadDistValues-security-policy
  # https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/secure-connections-supported-viewer-protocols-ciphers.html).
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2025"
  }
}
