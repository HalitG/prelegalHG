import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("does not submit a form unless asked to", () => {
    expect(renderToStaticMarkup(<Button>Go</Button>)).toContain('type="button"');
    expect(renderToStaticMarkup(<Button type="submit">Go</Button>)).toContain('type="submit"');
  });

  it("uses purple for the secondary variant, which is reserved for submitting forms", () => {
    expect(renderToStaticMarkup(<Button variant="secondary">Go</Button>)).toContain("bg-secondary");
  });
});
