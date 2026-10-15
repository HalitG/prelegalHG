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

  it("shows a spinner and can't be pressed while its action runs", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("animate-spin");
    expect(html).toContain("Save");
    expect(renderToStaticMarkup(<Button>Save</Button>)).not.toContain("aria-busy");
  });
});
