"""Quick integration test for Gemini provider."""

import asyncio
import sys
import os

# Run from backend/ directory so .env and app imports resolve correctly
sys.path.insert(0, os.path.dirname(__file__))


async def test_gemini():
    from app.llm.gemini_provider import GeminiProvider
    from app.llm.stream_helpers import collect_stream

    print("=== Gemini Integration Test ===\n")

    # 1. Initialize
    print("[1] Initializing provider...")
    provider = GeminiProvider()
    await provider.initialize()
    print("    OK - provider initialized\n")

    # 2. Streaming test
    print("[2] Streaming test (short prompt)...")
    prompt = "Reply with exactly: GEMINI_OK"
    tokens = []
    async for token in provider.generate_stream(prompt, max_tokens=16):
        tokens.append(token)
        print(f"    token: {repr(token)}")
    full = "".join(tokens)
    print(f"    Full response: {repr(full)}")
    assert full.strip(), "Empty response from Gemini"
    print("    OK - stream received\n")

    # 3. collect_stream helper
    print("[3] collect_stream helper test...")
    result = await collect_stream(provider, "Say the word: HELLO", max_tokens=16)
    print(f"    Result: {repr(result)}")
    assert result.strip(), "collect_stream returned empty"
    print("    OK - collect_stream works\n")

    # 4. JSON extraction in response
    print("[4] JSON extraction test (report-style prompt)...")
    json_prompt = (
        'You are a report assistant. The user says: "My name is Jane Doe".\n'
        'Extract the data and output JSON in this exact format:\n'
        '{"data": {"reporter_first_name": "Jane", "reporter_last_name": "Doe"}}\n'
        'Output ONLY the JSON, nothing else.'
    )
    json_result = await collect_stream(provider, json_prompt, max_tokens=64)
    print(f"    Raw output: {repr(json_result)}")

    import json, re
    match = re.search(r'\{.*\}', json_result, re.DOTALL)
    assert match, f"No JSON found in response: {json_result}"
    parsed = json.loads(match.group())
    assert "data" in parsed, f"Missing 'data' key: {parsed}"
    print(f"    Parsed: {parsed}")
    print("    OK - JSON response correct\n")

    # 5. Cleanup
    print("[5] Cleanup...")
    await provider.cleanup()
    print("    OK - provider cleaned up\n")

    print("=== All tests passed ===")


if __name__ == "__main__":
    asyncio.run(test_gemini())
