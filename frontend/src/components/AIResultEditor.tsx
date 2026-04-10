import { useState, useEffect } from "react"

type AIResult = {
  hook: string
  body: string
  cta: string
  hashtags: string[]
  full_caption: string
}

type Props = {
  result: AIResult
  onChange: (updated: AIResult) => void
}

export default function AIResultEditor({ result, onChange }: Props) {
  const [hook, setHook] = useState(result.hook)
  const [body, setBody] = useState(result.body)
  const [cta, setCta] = useState(result.cta)
  const [hashtags, setHashtags] = useState(result.hashtags.join(" "))

  // 🔥 Rebuild caption automatically
  useEffect(() => {
    const updated = {
      hook,
      body,
      cta,
      hashtags: hashtags.split(" ").filter(Boolean),
      full_caption: `${hook}\n\n${body}\n\n${cta}\n\n${hashtags}`,
    }

    onChange(updated)
  }, [hook, body, cta, hashtags])

  return (
    <div className="space-y-4 p-4 border rounded-xl bg-white shadow">

      <div>
        <label className="block text-sm font-medium">Hook</label>
        <input
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border p-2 rounded h-24"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">CTA</label>
        <input
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Hashtags</label>
        <input
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <div className="bg-gray-50 p-3 rounded border">
        <p className="text-xs text-gray-500 mb-1">Preview</p>
        <pre className="whitespace-pre-wrap text-sm">
          {`${hook}\n\n${body}\n\n${cta}\n\n${hashtags}`}
        </pre>
      </div>
    </div>
  )
}