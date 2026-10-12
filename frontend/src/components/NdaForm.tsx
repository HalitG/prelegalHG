import type { NdaFormData, Party } from "@/lib/nda/types";
import { ChoiceGroup, FormSection, TextField, YearsField } from "./form-controls";

interface NdaFormProps {
  form: NdaFormData;
  /** Today's ISO date, shown until the user picks an Effective Date. */
  today: string;
  onChange: (form: NdaFormData) => void;
}

export function NdaForm({ form, today, onChange }: NdaFormProps) {
  const set = (patch: Partial<NdaFormData>) => onChange({ ...form, ...patch });
  const setParty = (index: 0 | 1, patch: Partial<Party>) => {
    const parties: NdaFormData["parties"] = [...form.parties];
    parties[index] = { ...parties[index], ...patch };
    set({ parties });
  };

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()} aria-label="Mutual NDA details">
      <FormSection step={1} title="Parties" description="The two organisations sharing confidential information.">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {([0, 1] as const).map((index) => {
            const party = form.parties[index];
            return (
              <div key={index} className="space-y-4">
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Party {index + 1}</h3>
                <TextField
                  label="Company"
                  value={party.company}
                  onChange={(company) => setParty(index, { company })}
                  placeholder={index === 0 ? "Acme, Inc." : "Globex Corporation"}
                />
                <TextField
                  label="Signer name"
                  value={party.name}
                  onChange={(name) => setParty(index, { name })}
                  placeholder="Jane Doe"
                />
                <TextField
                  label="Signer title"
                  value={party.title}
                  onChange={(title) => setParty(index, { title })}
                  placeholder="Chief Executive Officer"
                />
                <TextField
                  label="Notice address"
                  value={party.noticeAddress}
                  onChange={(noticeAddress) => setParty(index, { noticeAddress })}
                  placeholder="legal@example.com"
                  hint="Email or postal address for legal notices."
                />
              </div>
            );
          })}
        </div>
      </FormSection>

      <FormSection step={2} title="Agreement terms" description="Why information is shared, and for how long.">
        <TextField
          label="Purpose"
          value={form.purpose}
          onChange={(purpose) => set({ purpose })}
          hint="How Confidential Information may be used."
          multiline
        />
        <TextField
          label="Effective date"
          type="date"
          value={form.effectiveDate ?? today}
          onChange={(effectiveDate) => set({ effectiveDate })}
        />
        <ChoiceGroup
          legend="MNDA term"
          value={form.mndaTerm}
          onChange={(mndaTerm) => set({ mndaTerm })}
          options={[
            { value: "expires", label: "Fixed term" },
            { value: "until-terminated", label: "Until terminated" },
          ]}
        >
          {form.mndaTerm === "expires" && (
            <YearsField
              label="MNDA term in years"
              value={form.mndaTermYears}
              onChange={(mndaTermYears) => set({ mndaTermYears })}
              suffix="year(s) from the Effective Date"
            />
          )}
        </ChoiceGroup>
        <ChoiceGroup
          legend="Term of confidentiality"
          value={form.confidentialityTerm}
          onChange={(confidentialityTerm) => set({ confidentialityTerm })}
          options={[
            { value: "years", label: "Fixed term" },
            { value: "perpetual", label: "In perpetuity" },
          ]}
        >
          {form.confidentialityTerm === "years" && (
            <YearsField
              label="Term of confidentiality in years"
              value={form.confidentialityYears}
              onChange={(confidentialityYears) => set({ confidentialityYears })}
              suffix="year(s); trade secrets stay protected while they remain trade secrets"
            />
          )}
        </ChoiceGroup>
      </FormSection>

      <FormSection step={3} title="Governing law" description="Which law applies and where disputes are heard.">
        <TextField
          label="Governing law (state)"
          value={form.governingLaw}
          onChange={(governingLaw) => set({ governingLaw })}
          placeholder="Delaware"
        />
        <TextField
          label="Jurisdiction"
          value={form.jurisdiction}
          onChange={(jurisdiction) => set({ jurisdiction })}
          placeholder="courts located in New Castle, DE"
          hint="The city or county and state whose courts hear disputes."
        />
      </FormSection>

      <FormSection step={4} title="Modifications" description="Optional changes to the Standard Terms.">
        <TextField
          label="MNDA modifications"
          value={form.modifications}
          onChange={(modifications) => set({ modifications })}
          placeholder="Leave blank if there are none."
          multiline
        />
      </FormSection>
    </form>
  );
}
