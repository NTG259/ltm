export default function CompilerErrorExplainer({ compileLog }) {
  if (!compileLog?.trim()) return null

  return <pre className="console-log m-0 max-h-96 overflow-y-auto">{compileLog}</pre>
}
