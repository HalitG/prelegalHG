import { applies, MAX_LONG_TEXT, MAX_NOTICE_ADDRESS, MAX_TEXT, PARTY_FIELDS } from "@/lib/documents/fields";
import type { DocState, DocumentDef, FieldDef, Party } from "@/lib/documents/types";
import { ChoiceGroup, FormSection, TextField, YearsField } from "./form-controls";

interface DocumentFormProps {
  document: DocumentDef;
  state: DocState;
  onChange: (state: DocState) => void;
}

function hint(field: FieldDef) {
  return field.default ? `${field.description} Suggested: ${field.default}` : field.description;
}

/** The chosen agreement's fields, generated from its definition in documents.json. */
export function DocumentForm({ document, state, onChange }: DocumentFormProps) {
  const setValue = (key: string, value: string) => onChange({ ...state, values: { ...state.values, [key]: value } });
  const setParty = (index: 0 | 1, patch: Partial<Party>) => {
    const parties: DocState["parties"] = [...state.parties];
    parties[index] = { ...parties[index], ...patch };
    onChange({ ...state, parties });
  };

  function control(field: FieldDef) {
    const value = state.values[field.key] ?? "";
    const onFieldChange = (next: string) => setValue(field.key, next);
    switch (field.kind) {
      case "choice": {
        // Fields that only apply to one of the options, such as a number of years, sit under the choice.
        const dependants = document.fields.filter((other) => other.showIf?.field === field.key);
        return (
          <ChoiceGroup key={field.key} legend={field.label} value={value} options={field.options ?? []} onChange={onFieldChange}>
            {dependants.filter((other) => applies(other, state.values)).map(control)}
          </ChoiceGroup>
        );
      }
      case "years":
        return (
          <YearsField key={field.key} label={field.label} value={value} onChange={onFieldChange} suffix="year(s)" />
        );
      default:
        return (
          <TextField
            key={field.key}
            label={field.label}
            value={value}
            onChange={onFieldChange}
            type={field.kind === "date" ? "date" : "text"}
            multiline={field.kind === "longText"}
            maxLength={field.kind === "longText" ? MAX_LONG_TEXT : MAX_TEXT}
            placeholder={field.placeholder}
            hint={hint(field)}
          />
        );
    }
  }

  const groups = (document.sections ?? [undefined]).map((section) => ({
    title: section ?? "Agreement terms",
    fields: document.fields.filter((field) => field.section === section && !field.showIf),
  }));

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()} aria-label={`${document.name} details`}>
      <FormSection step={1} title="Parties" description="The two organisations entering into the agreement.">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {([0, 1] as const).map((index) => (
            <fieldset key={index} className="space-y-4">
              <legend className="mb-4 text-xs font-semibold tracking-wider text-muted uppercase">
                {document.roles[index]}
              </legend>
              {PARTY_FIELDS.map(({ key, label }) => (
                <TextField
                  key={key}
                  label={label}
                  value={state.parties[index][key]}
                  onChange={(value) => setParty(index, { [key]: value })}
                  maxLength={key === "noticeAddress" ? MAX_NOTICE_ADDRESS : MAX_TEXT}
                  hint={key === "noticeAddress" ? "Email or postal address for legal notices." : undefined}
                />
              ))}
            </fieldset>
          ))}
        </div>
      </FormSection>

      {groups.map((group, i) => (
        <FormSection key={group.title} step={i + 2} title={group.title}>
          {group.fields.map(control)}
        </FormSection>
      ))}
    </form>
  );
}
