export interface Party {
  company: string;
  name: string;
  title: string;
  noticeAddress: string;
}

export interface NdaFormData {
  purpose: string;
  /** ISO date (yyyy-mm-dd). `null` means the user hasn't picked one, so today's date is used. */
  effectiveDate: string | null;
  mndaTerm: "expires" | "until-terminated";
  mndaTermYears: string;
  confidentialityTerm: "years" | "perpetual";
  confidentialityYears: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [Party, Party];
}

const emptyParty: Party = { company: "", name: "", title: "", noticeAddress: "" };

/** Defaults mirror the pre-selected options in templates/Mutual-NDA-coverpage.md. */
export const defaultFormData: NdaFormData = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: null,
  mndaTerm: "expires",
  mndaTermYears: "1",
  confidentialityTerm: "years",
  confidentialityYears: "1",
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  parties: [emptyParty, emptyParty],
};
