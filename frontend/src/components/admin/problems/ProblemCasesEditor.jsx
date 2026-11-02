import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Field, FieldGroup, FieldLabel } from '../../ui/field'
import { Textarea } from '../../ui/textarea'

export default function ProblemCasesEditor({ cases, label, addLabel, onChange }) {
  const updateCase = (index, field, value) => {
    onChange(cases.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }

  const removeCase = (index) => {
    onChange(cases.filter((_, itemIndex) => itemIndex !== index))
  }

  const addCase = () => onChange([...cases, { input: '', output: '' }])

  return (
    <div className="flex flex-col gap-3">
      {cases.map((item, index) => (
        <Card key={index} size="sm">
          <CardHeader className="border-b">
            <CardTitle className="font-mono">{label} #{index + 1}</CardTitle>
            <CardDescription>Chuẩn stdin và stdout của chương trình.</CardDescription>
            {cases.length > 1 && (
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeCase(index)}
                  aria-label={`Xóa ${label.toLocaleLowerCase('vi')} ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`case-${label}-${index}-input`}>Input</FieldLabel>
                <Textarea
                  id={`case-${label}-${index}-input`}
                  className="min-h-24 font-mono"
                  value={item.input}
                  onChange={(event) => updateCase(index, 'input', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`case-${label}-${index}-output`}>Output</FieldLabel>
                <Textarea
                  id={`case-${label}-${index}-output`}
                  className="min-h-24 font-mono"
                  value={item.output}
                  onChange={(event) => updateCase(index, 'output', event.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ))}
      <Button type="button" variant="outline" onClick={addCase}>
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  )
}
