// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { categoryTone, ServiceIcon, serviceInitials } from "./service-icon";

afterEach(cleanup);

const slot = (container: HTMLElement) => {
  const icon = container.querySelector<HTMLElement>('[data-slot="service-icon"]');
  if (icon === null) throw new Error("ServiceIcon not rendered");
  return icon;
};

const failImage = (container: HTMLElement) => {
  const img = slot(container).querySelector("img");
  if (img === null) throw new Error("image not rendered");
  fireEvent.error(img);
};

describe("ServiceIcon", () => {
  it("shows the image with the service name as alternative text", () => {
    const { container } = render(
      <ServiceIcon src="/icons/lambda.svg" name="AWS Lambda" category="compute" />,
    );
    const img = slot(container).querySelector("img");
    expect(img?.getAttribute("src")).toBe("/icons/lambda.svg");
    expect(img?.getAttribute("alt")).toBe("AWS Lambda");
    expect(slot(container).hasAttribute("data-fallback")).toBe(false);
  });

  it("uses an empty alt when the name is already next to the icon", () => {
    const { container } = render(
      <ServiceIcon src="/icons/lambda.svg" name="AWS Lambda" category="compute" decorative />,
    );
    expect(slot(container).querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("falls back to the initials over the category color when the image fails", () => {
    const { container } = render(
      <ServiceIcon
        src="/icons/apigateway.svg"
        name="Amazon API Gateway"
        category="networking-content-delivery"
      />,
    );
    failImage(container);

    const icon = slot(container);
    expect(icon.querySelector("img")).toBeNull();
    expect(icon.textContent).toBe("AG");
    expect(icon.hasAttribute("data-fallback")).toBe(true);
    expect(icon.classList).toContain("bg-blueprint-soft");
    expect(icon.getAttribute("role")).toBe("img");
    expect(icon.getAttribute("aria-label")).toBe("Amazon API Gateway");
  });

  it("shows the fallback without src, hidden from screen readers when decorative", () => {
    const { container } = render(<ServiceIcon name="Amazon EC2" category="compute" decorative />);
    const icon = slot(container);
    expect(icon.textContent).toBe("EC2");
    expect(icon.classList).toContain("bg-warning-soft");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.hasAttribute("role")).toBe(false);
  });

  it("tries a new src again after a failure", () => {
    const { container, rerender } = render(
      <ServiceIcon src="/icons/a.svg" name="Amazon S3" category="storage" />,
    );
    failImage(container);
    expect(slot(container).querySelector("img")).toBeNull();

    rerender(<ServiceIcon src="/icons/b.svg" name="Amazon S3" category="storage" />);
    expect(slot(container).querySelector("img")?.getAttribute("src")).toBe("/icons/b.svg");
  });
});

describe("serviceInitials", () => {
  it.each([
    ["Amazon API Gateway", "AG"],
    ["Amazon EventBridge", "EVE"],
    ["Amazon EC2", "EC2"],
    ["Amazon S3", "S3"],
    ["Amazon Route 53", "R53"],
    ["Application Load Balancer", "ALB"],
    ["AWS Step Functions", "SF"],
    ["AWS Lambda", "LAM"],
    ["AWS", "AWS"],
  ])("%s → %s", (name, initials) => {
    expect(serviceInitials(name)).toBe(initials);
  });
});

describe("categoryTone", () => {
  it.each([
    ["networking-content-delivery", "network"],
    ["storage", "storage"],
    ["compute", "compute"],
    ["containers", "compute"],
    ["security-identity", "security"],
    ["application-integration", "default"],
    ["unknown", "default"],
  ])("%s → %s", (category, tone) => {
    expect(categoryTone(category)).toBe(tone);
  });
});
