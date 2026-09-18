import { useEffect, useRef } from 'react'

function languageFor(path: string): string {
  if (path.endsWith('.java')) return 'java'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml'
  if (path.endsWith('.md')) return 'markdown'
  if (path.endsWith('.toml')) return 'ini'
  if (path.endsWith('.gradle') || path.endsWith('.properties')) return 'plaintext'
  return 'plaintext'
}

export function MonacoEditor({
  path,
  value,
  onChange,
  readOnly
}: {
  path: string
  value: string
  onChange: (next: string) => void
  readOnly?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    let disposed = false
    void import('./monacoSetup').then(({ monaco }) => {
      if (disposed || !host.current) {
        return
      }
      editorRef.current?.dispose()
      const editor = monaco.editor.create(host.current, {
        value,
        language: languageFor(path),
        readOnly,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        theme: 'vs',
        scrollBeyondLastLine: false
      })
      editor.onDidChangeModelContent(() => {
        onChange(editor.getValue())
      })
      editorRef.current = editor
    })
    return () => {
      disposed = true
      editorRef.current?.dispose()
      editorRef.current = null
    }
    // Recreate when the file path changes; value updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly])

  useEffect(() => {
    const editor = editorRef.current
    if (editor && editor.getValue() !== value) {
      editor.setValue(value)
    }
  }, [value])

  return <div ref={host} className="min-h-[28rem] w-full" />
}
