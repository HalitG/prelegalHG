import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { SIGNING_STATEMENT, type CoverPageModel, type Piece } from "@/lib/nda/coverPage";
import type { Run } from "@/lib/nda/markdown";
import type { MndaTemplate } from "@/lib/nda/template";

/**
 * Embedded Source Serif 4 (matching the web preview). Unlike the PDF built-in fonts, which only
 * cover Western European characters, it renders Latin Extended, Greek and Cyrillic user input.
 */
const SERIF = "Source Serif 4";

/** Registers the embedded fonts. `fontDir` is a URL path in the browser, or a file path in tests. */
export function registerPdfFonts(fontDir: string) {
  Font.register({
    family: SERIF,
    fonts: [
      { src: `${fontDir}/SourceSerif4-Regular.ttf`, fontWeight: "normal" },
      { src: `${fontDir}/SourceSerif4-Bold.ttf`, fontWeight: "bold" },
    ],
  });
}

// Legal text reads better without words being hyphenated across lines.
Font.registerHyphenationCallback((word) => [word]);

/**
 * react-pdf also treats a style change inside a word (e.g. a bold term followed by
 * a closing quote) as a hyphenation point. A penalty of 10000 forbids those breaks.
 */
const NO_HYPHENATION = 10000;

/** Printed in place of a field the user left blank, so it can be completed by hand. */
const BLANK = "______________________";

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 72,
    paddingHorizontal: 72,
    fontFamily: SERIF,
    fontSize: 10.5,
    color: "#1e293b",
    // Ligature glyphs (fi, ff) lack a text mapping, so "Confidential" would copy and search as "Confdential".
    fontFeatureSettings: { liga: false },
  },
  // Not set on the Page: an inherited lineHeight hides the absolutely positioned footer, and a
  // unitless lineHeight is resolved against the default font size unless fontSize sits beside it.
  prose: { fontSize: 10.5, lineHeight: 1.45 },
  title: { fontFamily: SERIF, fontWeight: "bold", fontSize: 18, textAlign: "center", color: "#0f172a" },
  subtitle: {
    marginTop: 4,
    marginBottom: 18,
    fontFamily: "Helvetica",
    fontSize: 8,
    letterSpacing: 2,
    textAlign: "center",
    color: "#94a3b8",
  },
  section: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  sectionLabel: { width: "30%", paddingRight: 10 },
  sectionTitle: { fontFamily: SERIF, fontWeight: "bold", color: "#0f172a" },
  caption: { fontFamily: "Helvetica", fontSize: 7.5, color: "#94a3b8", lineHeight: 1.3 },
  sectionBody: { width: "70%" },
  bold: { fontFamily: SERIF, fontWeight: "bold" },
  link: { color: "#3730a3", textDecoration: "none" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1" },
  tableLabel: { width: "28%", paddingVertical: 7, paddingRight: 8 },
  tableCell: { width: "36%", paddingVertical: 7, paddingHorizontal: 8 },
  tableHead: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1, color: "#64748b" },
  heading: { fontFamily: SERIF, fontWeight: "bold", fontSize: 14, textAlign: "center", marginBottom: 12, color: "#0f172a" },
  clause: { marginBottom: 7, textAlign: "justify" },
  attribution: { marginTop: 10, fontFamily: "Helvetica", fontSize: 7.5, textAlign: "center", color: "#94a3b8" },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 72,
    right: 72,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    switch (run.type) {
      case "text":
      case "term":
        return run.text;
      case "bold":
        return (
          <Text key={i} style={styles.bold}>
            {run.text}
          </Text>
        );
      case "link":
        return (
          <Link key={i} src={run.href} style={styles.link}>
            {run.text}
          </Link>
        );
    }
  });
}

const pieceText = (piece: Piece) => (typeof piece === "string" ? piece : piece.value || BLANK);

function PdfPage({ children }: { children: ReactNode }) {
  return (
    <Page size="LETTER" style={styles.page}>
      {children}
      <View style={styles.footer} fixed>
        <Text>Common Paper Mutual Non-Disclosure Agreement (Version 1.0)</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

export function NdaPdfDocument({ template, coverPage }: { template: MndaTemplate; coverPage: CoverPageModel }) {
  return (
    <Document title="Mutual Non-Disclosure Agreement" creator="prelegal" producer="prelegal">
      <PdfPage>
        <Text style={styles.title}>Mutual Non-Disclosure Agreement</Text>
        <Text style={styles.subtitle}>COVER PAGE</Text>
        <Text style={[styles.prose, { marginBottom: 12 }]} hyphenationPenalty={NO_HYPHENATION}>
          <Runs runs={template.coverPageIntro} />
        </Text>

        {coverPage.sections.map((section) => (
          <View key={section.title} style={styles.section} wrap={false}>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.caption && <Text style={styles.caption}>{section.caption}</Text>}
            </View>
            <View style={styles.sectionBody}>
              {section.paragraphs.map((paragraph, i) => (
                <Text key={i} style={styles.prose}>
                  {paragraph.map(pieceText).join("")}
                </Text>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.prose, { marginTop: 14, marginBottom: 8 }]}>{SIGNING_STATEMENT}</Text>

        <View wrap={false}>
          <View style={[styles.tableRow, { borderBottomColor: "#94a3b8" }]}>
            <Text style={styles.tableLabel} />
            <Text style={[styles.tableCell, styles.tableHead]}>PARTY 1</Text>
            <Text style={[styles.tableCell, styles.tableHead]}>PARTY 2</Text>
          </View>
          {coverPage.signatureRows.map((row) => (
            <View key={row.label} style={[styles.tableRow, { minHeight: row.tall ? 40 : 26 }]}>
              <View style={styles.tableLabel}>
                <Text style={styles.sectionTitle}>{row.label}</Text>
                {row.caption && <Text style={styles.caption}>{row.caption}</Text>}
              </View>
              {row.cells.map((cell, i) => (
                <Text key={i} style={styles.tableCell}>
                  {pieceText(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </PdfPage>

      <PdfPage>
        {template.standardTerms.map((block, i) => {
          switch (block.type) {
            case "heading":
              return (
                <Text key={i} style={styles.heading}>
                  {block.text}
                </Text>
              );
            case "clause":
              return (
                <Text key={i} style={[styles.prose, styles.clause]} hyphenationPenalty={NO_HYPHENATION}>
                  {block.number}. <Runs runs={block.runs} />
                </Text>
              );
            case "paragraph":
              return (
                <Text key={i} style={styles.attribution} hyphenationPenalty={NO_HYPHENATION}>
                  <Runs runs={block.runs} />
                </Text>
              );
          }
        })}
      </PdfPage>
    </Document>
  );
}
