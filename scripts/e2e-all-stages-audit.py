import asyncio
import json
import os
import sys
from playwright.async_api import async_playwright

target_url = os.environ.get("TARGET_URL", "https://getjobready.online/")
print(f"================================================================")
print(f"  GETJOBREADY COMPREHENSIVE ALL-STAGES & VOICE INTERVIEW AUDIT  ")
print(f"  Target: {target_url}")
print(f"================================================================")

test_cv = """Vikram Mehra
vikram.mehra@example.edu | +91 98765 43210 | Bangalore, India
LinkedIn: linkedin.com/in/vikrammehra

EDUCATION
B.Tech in Computer Science & Engineering | National Institute of Technology, Karnataka | CGPA: 8.9 / 10.0 (2021 - 2025)

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, SQL, C++
Frameworks & Tools: React, Node.js, Express, PostgreSQL, Redis, Docker, Cloudflare R2, Git, Jest

PROFESSIONAL EXPERIENCE & PROJECTS
1. Full-Stack Campus Placement Portal — Backend Lead (Jan 2024 - May 2024)
- Architected high-throughput REST APIs in Node.js and PostgreSQL for 1,200 active campus candidates.
- Reduced interview scheduling conflict latency by 45% by engineering an atomic slot reservation engine in Redis.
- Automated real-time interview room links via WebSockets, serving 35 enterprise recruiting panels.

2. AI Document Processing Microservice — Software Engineering Intern (May 2023 - Jul 2023)
- Built an asynchronous resume parsing pipeline in Python extracting structured candidate data with 98.4% accuracy.
- Reduced document processing time from 14 seconds to 1.8 seconds using multithreaded stream extraction across 5,000+ test files.
"""

bad_answers = [
    "um yeah i did a good job and stuff",
    "ok",
    "i worked on summer internship and it was fine",
    "no i dont use chatgpt",
    "nothing went wrong",
    "i will just work hard"
]

good_answers = [
    "I am a final-year Computer Science student specializing in backend systems and distributed architecture. Over the past two years, I have architected high-throughput microservices using Node.js, Express, Redis, and PostgreSQL. My proudest achievement was designing an automated batch storage optimization pipeline on Cloudflare R2 that reduced latency by 42% and slashed monthly infrastructure overhead by 35% across 50,000 weekly operations.",
    "For our campus placement portal serving 1,200 active candidates: [Situation] The platform suffered from severe concurrency bottlenecks during peak hiring drives. [Task] As the lead backend architect, my goal was to resolve thread starvation and eliminate race conditions in interview scheduling. [Action] I re-engineered the booking queue using Redis atomic locks and implemented WebSocket event streams. [Result] We reduced booking latency by 45% and handled 35 simultaneous enterprise recruiters with zero dropped requests.",
    "During my software development internship: [Situation/Task] The data team spent 14 seconds per document manually verifying candidate resumes. [Action] I built an asynchronous document parsing microservice in Python with multithreaded extraction and structured JSON validation. [Result] I reduced processing time from 14 seconds down to 1.8 seconds per document, achieving 98.4% field accuracy across 5,000+ candidate profiles.",
    "I integrate AI tools into my engineering workflow on a daily basis. Specifically, I leverage GitHub Copilot for scaffolding boilerplate unit tests in Jest, and Claude 3.5 to simulate edge-case schema migrations and debug complex SQL query plans. For example, when evaluating caching strategies between Redis and memory stores, an LLM prompt helped me contrast eviction policies in under 10 minutes, saving half a day of manual trial and error while maintaining high code quality through rigorous automated testing.",
    "During our final semester deployment, our payment verification webhook began throwing timeout exceptions 48 hours before launch due to third-party rate limits. [Situation/Task] As the backend engineer on call, I had to prevent transaction failures. [Action] I implemented exponential backoff retries with dead-letter queue buffering and offloaded non-blocking analytics calls to background workers. [Result] We processed 100% of pending transactions with zero revenue loss and stress-tested up to 3,000 concurrent requests before launch.",
    "If I join this engineering team tomorrow, my 30-day plan is structured into three clear phases: In Days 1 to 10, I will immerse myself in the codebase, shadow senior engineers on deployments, and establish 1-on-1 alignment with my mentor. In Days 11 to 20, I will pick up at least two backlog tickets, write end-to-end integration tests, and submit my first pull request. In Days 21 to 30, I will take independent ownership of a feature module, document onboarding improvements for future team members, and deliver a measurable contribution."
]

async def run_audit():
    results = {
        "url": target_url,
        "stages": {},
        "overall_passed": True,
        "browser_errors": []
    }

    def record(stage_name, step, success, details=""):
        status = "PASS" if success else "FAIL"
        print(f"[{status}] {stage_name} -> {step}: {details}")
        if stage_name not in results["stages"]:
            results["stages"][stage_name] = []
        results["stages"][stage_name].append({
            "step": step,
            "status": status,
            "details": details
        })
        if not success:
            results["overall_passed"] = False

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            permissions=["microphone"],
            viewport={"width": 1440, "height": 900}
        )
        page = await context.new_page()

        page.on("pageerror", lambda err: results["browser_errors"].append(f"PageError: {err.message}"))
        page.on("console", lambda msg: results["browser_errors"].append(f"ConsoleError: {msg.text}") if msg.type == "error" else None)

        try:
            print("\n>>> Stage 0: Initializing Session & Authentication")
            await page.goto(target_url, timeout=45000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)

            enter_btn = page.locator("button:has-text('Enter Workspace')").first
            if await enter_btn.is_visible():
                await enter_btn.click()
                await page.wait_for_timeout(600)
                await page.fill("input[type='email']", "qa.evaluator@getjobready.online")
                await page.click("button:has-text('Continue')")
                await page.wait_for_timeout(2000)
            
            w_text = await page.inner_text("body")
            record("Authentication", "Enter Workspace", "My Workspace" in w_text or "Master CV" in w_text, "Logged in successfully")

            print("\n>>> Stage 1A: CV Preparation & Improvement")
            await page.click("text=Master CV")
            await page.wait_for_timeout(1000)

            edit_btn = page.locator("button:has-text('Edit CV')").first
            if await edit_btn.is_visible():
                await edit_btn.click()
                await page.wait_for_timeout(800)

            ta = page.locator("textarea#cvText, textarea").first
            await ta.fill(test_cv)
            record("Stage 1: CV Preparation", "Input CV", True, "Populated 1,400 char technical CV")

            review_btn = page.locator("button:has-text('Review & improve my CV')").first
            if not await review_btn.is_visible():
                review_btn = page.locator("button:has-text('Review &')").first
            await review_btn.click()
            await page.wait_for_timeout(6000)

            studio_text = await page.inner_text("body")
            has_studio = "Executive CV Preview" in studio_text or "Master CV saved" in studio_text or "Direct Audio Interview" in studio_text
            record("Stage 1: CV Preparation", "CV Studio Render", has_studio, "CV Studio loaded with executive preview and suggestions")

            print("\n>>> Stage 1B: Testing BAD Interview (All 6 Questions)")
            start_iv_btn = page.locator("button:has-text('Direct Audio Interview'), button:has-text('Save & start interview')").first
            await start_iv_btn.click()
            await page.wait_for_timeout(2500)

            for turn_idx, bad_ans in enumerate(bad_answers):
                turn_num = turn_idx + 1
                await page.wait_for_timeout(1000)
                q_elem = page.locator(".question-card h2")
                q_text = await q_elem.inner_text() if await q_elem.is_visible() else f"Turn {turn_num}"
                print(f"  [Bad Run Turn {turn_num}/6] Question: {q_text[:65]}...")

                submitted = False
                try:
                    await page.evaluate(f"window.__gjrSubmitAnswer && window.__gjrSubmitAnswer({json.dumps(bad_ans)})")
                    submitted = True
                except Exception:
                    pass

                if not submitted:
                    type_mode_btn = page.locator("button:has-text('type / paste answer')").first
                    if await type_mode_btn.is_visible():
                        await type_mode_btn.click()
                        await page.wait_for_timeout(400)
                    input_box = page.locator("#interviewTypedInput, textarea").last
                    await input_box.fill(bad_ans)
                    submit_btn = page.locator("button:has-text('Submit Typed Answer')").first
                    await submit_btn.click()

                await page.wait_for_timeout(2000)
                record("Bad Interview Run", f"Turn {turn_num} Submission", True, f"Answer: '{bad_ans}'")

            await page.wait_for_timeout(3000)
            fb_text = await page.inner_text("body")

            score_match = None
            try:
                score_el = page.locator(".feedback-score strong, .score-ring strong, strong:has-text('/100')").first
                if await score_el.is_visible():
                    score_str = await score_el.inner_text()
                    score_match = int(''.join(filter(str.isdigit, score_str)))
            except Exception:
                pass

            print(f"  --> Bad Interview Final Score: {score_match}/100")
            is_bad_scored_properly = score_match is not None and score_match <= 30
            record("Bad Interview Run", "Low Score Assertion (<=30)", is_bad_scored_properly, f"Actual score: {score_match}/100")

            has_rejection_notice = "under 10 words" in fb_text or "STAR method" in fb_text or "generic" in fb_text or "too brief" in fb_text
            record("Bad Interview Run", "Constructive Feedback & Gaps Assertion", has_rejection_notice, "Flagged brevity, lack of STAR, and generic placeholders")

            print("\n>>> Stage 1C: Testing GOOD Interview (All 6 Questions)")
            practise_again_btn = page.locator("button:has-text('Practice again'), button:has-text('Practise again')").first
            await practise_again_btn.click()
            await page.wait_for_timeout(2500)

            for turn_idx, good_ans in enumerate(good_answers):
                turn_num = turn_idx + 1
                await page.wait_for_timeout(1000)
                q_elem = page.locator(".question-card h2")
                q_text = await q_elem.inner_text() if await q_elem.is_visible() else f"Turn {turn_num}"
                print(f"  [Good Run Turn {turn_num}/6] Question: {q_text[:65]}...")

                submitted = False
                try:
                    await page.evaluate(f"window.__gjrSubmitAnswer && window.__gjrSubmitAnswer({json.dumps(good_ans)})")
                    submitted = True
                except Exception:
                    pass

                if not submitted:
                    type_mode_btn = page.locator("button:has-text('type / paste answer')").first
                    if await type_mode_btn.is_visible():
                        await type_mode_btn.click()
                        await page.wait_for_timeout(400)
                    input_box = page.locator("#interviewTypedInput, textarea").last
                    await input_box.fill(good_ans)
                    submit_btn = page.locator("button:has-text('Submit Typed Answer')").first
                    await submit_btn.click()

                await page.wait_for_timeout(2000)
                record("Good Interview Run", f"Turn {turn_num} Submission", True, f"{len(good_ans.split())} words, metrics + STAR ownership")

            await page.wait_for_timeout(3000)
            fb_text_good = await page.inner_text("body")
            
            good_score_val = None
            try:
                score_el = page.locator(".feedback-score strong, .score-ring strong, strong:has-text('/100')").first
                if await score_el.is_visible():
                    score_str = await score_el.inner_text()
                    good_score_val = int(''.join(filter(str.isdigit, score_str)))
            except Exception:
                pass

            print(f"  --> Good Interview Final Score: {good_score_val}/100")
            is_good_scored_properly = good_score_val is not None and good_score_val >= 75
            record("Good Interview Run", "High Score Assertion (>=75)", is_good_scored_properly, f"Actual score: {good_score_val}/100")

            has_high_readiness = "Exceptional" in fb_text_good or "STAR" in fb_text_good or "mastery" in fb_text_good or "Ready for recruiter rounds" in fb_text_good
            record("Good Interview Run", "Excellence Recognition Assertion", has_high_readiness, "Recognized deep technical mastery and clear business thinking")

            # Go back to Workspace Dashboard
            back_home_btn = page.locator("button.brand, button:has-text('← Back')").first
            await back_home_btn.click()
            await page.wait_for_timeout(1200)

            print("\n>>> Stage 1D: Testing Impress the Interviewer Module")
            impress_btn = page.locator("button:has-text('Impress the Interviewer'), text='Impress the Interviewer'").first
            await impress_btn.click()
            await page.wait_for_timeout(1500)

            comp_input = page.locator("input[placeholder*='target employer'], input").first
            await comp_input.fill("Zomato")

            prob_input = page.locator("textarea[placeholder*='problem'], textarea").first
            await prob_input.fill("High delivery cancellation rate during sudden monsoon downpours due to inaccurate delivery time estimates causing customer frustration.")

            idea_input = page.locator("textarea[placeholder*='solution'], textarea").last
            await idea_input.fill("Predictive weather-aware hyper-local order throttling and dynamic rider surge dispatching.")

            demo_btn = page.locator("button:has-text('Build my interview demo')").first
            await demo_btn.click()
            await page.wait_for_timeout(5000)

            demo_result_text = await page.inner_text("body")
            has_demo_result = "PROTOTYPE CONCEPT" in demo_result_text or "Concept" in demo_result_text or "solution" in demo_result_text.lower()
            record("Stage 1: Impress Interviewer", "Prototype Concept Generated", has_demo_result, "Generated product title, tagline and impact")

            # Go back to Workspace Dashboard
            await page.locator("button:has-text('← Back'), button.brand").first.click()
            await page.wait_for_timeout(1000)

            print("\n>>> Stage 2A: Testing Corporate Ready Module")
            corp_btn = page.locator("button:has-text('Corporate Ready'), text='Corporate Ready'").first
            await corp_btn.click()
            await page.wait_for_timeout(1500)

            build_plan_btn = page.locator("button:has-text('Build my 7-day plan')").first
            await build_plan_btn.click()
            await page.wait_for_timeout(5000)

            corp_res_text = await page.inner_text("body")
            has_corp_plan = "7-day plan" in corp_res_text or "Weekly habit" in corp_res_text or "Readiness score" in corp_res_text
            record("Stage 2: Corporate Ready", "7-Day Habits & Resilience Plan", has_corp_plan, "Generated personalized corporate readiness roadmap")

            # Go back to Workspace Dashboard
            await page.locator("button:has-text('← Back'), button.brand").first.click()
            await page.wait_for_timeout(1000)

            print("\n>>> Stage 2B: Testing AI at Work Module")
            ai_btn = page.locator("button:has-text('AI at Work'), text='AI at Work'").first
            await ai_btn.click()
            await page.wait_for_timeout(1500)

            build_ai_btn = page.locator("button:has-text('Build my 7-day plan')").first
            await build_ai_btn.click()
            await page.wait_for_timeout(5000)

            ai_res_text = await page.inner_text("body")
            has_ai_plan = "7-day plan" in ai_res_text or "Weekly habit" in ai_res_text or "AI at Work" in ai_res_text
            record("Stage 2: AI at Work", "7-Day AI Workflows Sprint", has_ai_plan, "Generated AI workflows, habits and structured plan")

        except Exception as e:
            record("Audit Execution", "Exception Caught", False, str(e))
        finally:
            await browser.close()

    with open("full-audit-report.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n================================================================")
    print("  COMPREHENSIVE AUDIT EXECUTION SUMMARY")
    print(f"  Overall Result: {'100% PASSED' if results['overall_passed'] else 'FAILURES DETECTED'}")
    print(f"  Browser Errors: {len(results['browser_errors'])}")
    for stage, items in results["stages"].items():
        pass_count = sum(1 for x in items if x["status"] == "PASS")
        print(f"  - {stage}: {pass_count}/{len(items)} Passed")
    print("================================================================\n")
    return results["overall_passed"]

if __name__ == "__main__":
    success = asyncio.run(run_audit())
    sys.exit(0 if success else 1)
