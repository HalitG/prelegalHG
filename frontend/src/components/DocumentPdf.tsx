import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { CoverPageModel, Piece } from "@/lib/documents/coverPage";
import type { Clause, Inline } from "@/lib/documents/parse";
import type { DocumentDef, DocumentText } from "@/lib/documents/types";

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
  groupTitle: { marginTop: 12, marginBottom: 2, fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.5, color: "#64748b" },
  sectionHeading: { marginTop: 6, marginBottom: 5, fontFamily: SERIF, fontWeight: "bold", color: "#0f172a" },
  clause: { flexDirection: "row", marginBottom: 5 },
  // Wide enough for the longest numbers, such as "13.33".
  clauseLabel: { width: 32, paddingRight: 4 },
  clauseBody: { flex: 1 },
  clauseText: { textAlign: "justify" },
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

function Inlines({ runs }: { runs: Inline[] }) {
  return runs.map((run, i) => {
    switch (run.type) {
      case "text":
      case "term":
        return run.text;
      case "bold":
        return (
          <Text key={i} style={styles.bold}>
            <Inlines runs={run.children} />
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

function PdfPage({ footer, children }: { footer: string; children: ReactNode }) {
  return (
    <Page size="LETTER" style={styles.page}>
      {children}
      <View style={styles.footer} fixed>
        <Text>{footer}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

function ClauseView({ clause, depth }: { clause: Clause; depth: number }) {
  const children = clause.children.map((child, i) => <ClauseView key={i} clause={child} depth={depth + 1} />);
  // A top-level clause with a title and no text of its own is a section heading.
  if (depth === 0 && clause.title && clause.content.length === 0) {
    return (
      <View>
        <Text style={[styles.prose, styles.sectionHeading]} minPresenceAhead={40}>
          {clause.label} {clause.title}
        </Text>
        {children}
      </View>
    );
  }
  return (
    <View style={styles.clause}>
      <Text style={[styles.prose, styles.clauseLabel]}>{clause.label}</Text>
      <View style={styles.clauseBody}>
        <Text style={[styles.prose, styles.clauseText]} hyphenationPenalty={NO_HYPHENATION}>
          {clause.title && <Text style={styles.bold}>{clause.title} </Text>}
          <Inlines runs={clause.content} />
        </Text>
        {children.length > 0 && <View style={{ marginTop: 5 }}>{children}</View>}
      </View>
    </View>
  );
}

interface DocumentPdfProps {
  document: DocumentDef;
  text: DocumentText;
  coverPage: CoverPageModel;
}

export function DocumentPdf({ document, text, coverPage }: DocumentPdfProps) {
  const footer = `Common Paper ${document.name}`;
  return (
    <Document title={document.name} creator="prelegal" producer="prelegal">
      <PdfPage footer={footer}>
        <Text style={styles.title}>{document.name}</Text>
        <Text style={styles.subtitle}>COVER PAGE</Text>
        {text.intro && (
          <Text style={[styles.prose, { marginBottom: 12 }]} hyphenationPenalty={NO_HYPHENATION}>
            <Inlines runs={text.intro} />
          </Text>
        )}

        {coverPage.groups.map((group, i) => (
          <View key={group.title ?? i}>
            {group.title && <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>}
            {group.sections.map((section) => (
              <View key={section.title} style={styles.section} wrap={false}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.caption && <Text style={styles.caption}>{section.caption}</Text>}
                </View>
                <View style={styles.sectionBody}>
                  {section.paragraphs.map((paragraph, j) => (
                    <Text key={j} style={styles.prose}>
                      {paragraph.map(pieceText).join("")}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}

        <Text style={[styles.prose, { marginTop: 14, marginBottom: 8 }]}>{coverPage.signingStatement}</Text>

        <View wrap={false}>
          <View style={[styles.tableRow, { borderBottomColor: "#94a3b8" }]}>
            <Text style={styles.tableLabel} />
            {coverPage.roles.map((role) => (
              <Text key={role} style={[styles.tableCell, styles.tableHead]}>
                {role.toUpperCase()}
              </Text>
            ))}
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

      <PdfPage footer={footer}>
        {text.terms.map((block, i) => {
          switch (block.type) {
            case "heading":
              return (
                <Text key={i} style={styles.heading}>
                  {block.text}
                </Text>
              );
            case "clause":
              return <ClauseView key={i} clause={block} depth={0} />;
            case "paragraph":
              return (
                <Text key={i} style={styles.attribution} hyphenationPenalty={NO_HYPHENATION}>
                  <Inlines runs={block.content} />
                </Text>
              );
          }
        })}
      </PdfPage>
    </Document>
  );
}
