// components/RichTextEditor.tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = "Typ hier je opgemaakte tekst..." }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Je kunt hier opties uitschakelen of finetunen indien gewenst
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm prose-slate focus:outline-none min-h-[120px] max-h-[300px] overflow-y-auto px-3 py-2 text-sm text-slate-800 w-full placeholder:text-slate-400 bg-white rounded-b-lg",
      },
    },
    onUpdate: ({ editor }) => {
      // Stuur de opgemaakte HTML-string terug naar de parent component
      onChange(editor.getHTML());
    },
  });

  // Synchroniseer externe waarde-updates (bijv. als het formulier gereset wordt)
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="w-full rounded-lg border border-slate-300 overflow-hidden shadow-sm focus-within:border-blue-500 transition-colors bg-white">
      {/* TOOLBAR */}
      <div className="flex flex-wrap gap-1 items-center bg-slate-50 border-b border-slate-200 p-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive("bold") ? "bg-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-xs italic transition-colors ${
            editor.isActive("italic") ? "bg-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-2 py-1 rounded text-xs line-through transition-colors ${
            editor.isActive("strike") ? "bg-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          S
        </button>
        <div className="w-[1px] h-4 bg-slate-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive("bulletList") ? "bg-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          • Lijst
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive("orderedList") ? "bg-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          1. Lijst
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
            editor.isActive("codeBlock") ? "bg-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          Code
        </button>
        <div className="w-[1px] h-4 bg-slate-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 transition-colors"
          title="Wis alle opmaak"
        >
          Wis
        </button>
      </div>

      {/* ACTUELE EDITOR-INVOER */}
      <EditorContent editor={editor} />
    </div>
  );
}