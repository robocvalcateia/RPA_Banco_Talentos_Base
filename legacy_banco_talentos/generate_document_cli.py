import argparse
import importlib.util
import json
import os
import sys
import traceback

MARKER = "__DOCX_RESULT__="


def load_word_generator():
    module_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "modules", "word_generator.py")
    spec = importlib.util.spec_from_file_location("legacy_word_generator", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.WordGenerator


def main():
    parser = argparse.ArgumentParser(description="Gera DOCX de candidato usando os templates legados.")
    parser.add_argument("--template-id", required=True)
    parser.add_argument("--candidate-json", required=True)
    args = parser.parse_args()

    try:
        with open(args.candidate_json, "r", encoding="utf-8") as f:
            candidate_data = json.load(f)

        WordGenerator = load_word_generator()
        generator = WordGenerator("templates")
        output_path, filename = generator.generate_document(args.template_id, candidate_data)

        print(MARKER + json.dumps({
            "success": True,
            "path": os.path.abspath(output_path),
            "filename": filename
        }, ensure_ascii=True))
        return 0
    except Exception as exc:
        print(traceback.format_exc(), file=sys.stderr)
        print(MARKER + json.dumps({
            "success": False,
            "error": str(exc)
        }, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
