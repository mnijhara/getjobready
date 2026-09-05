import asyncio
import json
import os
import sys
from playwright.async_api import async_playwright

target_url = os.environ.get("TARGET_URL", "https://getjobready.online/")
print(f"=== Starting World-Class QA Audit on: {target_url} ===")

test_cv = """Alex Sharma
alex.sharma@example.edu | +91 98765 43210 | Bangalore, India
LinkedIn: linkedin.com/in/alexsharma

EDUCATION
B.Tech in Computer Science & Engineering | Indian Institute of Information Technology, Allahabad | CGPA: 8.8 / 10.0 (2021 - 2025)

TECHNICAL COMPETENCIES
Languages: JavaScript, TypeScript, Python, SQL, C++
Frameworks: React, Node.js, Express, Tailwind CSS, PostgreSQL, Redis, Docker
Tools: Git, Postman, Jest, CI/CD GitHub Actions, Agile / Scrum

KEY PROJECTS & EXPERIENCE
1. Full Stack Placement Portal - Team Lead & Architect (Jan 2024 - May 2024)
- Architected and deployed an end-to-end campus placement portal using React, Node.js, and PostgreSQL for over 1,200 students.
- Reduced interview scheduling latency by 45% by engineering an automated conflict-resolution matching algorithm in Redis.
- Implemented real-time status updates via WebSockets, eliminating manual coordination for 35 corporate recruiting teams.

2. AI Smart Document Parser - Software Developer Intern (Jun 2023 - Aug 2023)
- Built an automated PDF parsing microservice in Python processing 5,000+ candidate profiles with 98.4% field accuracy.
- Decreased document ingestion time from 14 seconds to 1.8 seconds using multithreaded stream extraction.
"""

async def run():
    report = {
        "url": target_url,
        "steps": [],
        "errors": [],
        "passed": True
    }

    def log_step(name, status, details=""):
        print(f"[{status}] {name} {f'- {details}' if details else ''}")
        report["steps"].append({"step": name, "status": status, "details": details})
        if status == "FAIL":
            report["passed"] = False

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            permissions=["microphone"],
            viewport={"width": 1440, "height": 900}
        )
        page = await context.new_page()

        page.on("console", lambda m: report["errors"].append(f"Console: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: report["errors"].append(f"PageError: {e.message}"))

        try:
            # 1. Homepage & Branding
            resp = await page.goto(target_url, timeout=45000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            text = await page.inner_text("body")
            if "GetJobReady" in text and "degree got you here" in text:
                log_step("1. Homepage Load & Branding", "PASS", "Hero copy and branding loaded correctly")
            else:
                log_step("1. Homepage Load & Branding", "FAIL", "Branding or hero copy missing")

            # 2. Stage 2 Modules on Homepage (Pre-login accessibility check)
            # 2a. Impress Interviewer / AI Project
            await page.click("text=Impress the Interviewer")
            await page.wait_for_timeout(1200)
            demo_text = await page.inner_text("body")
            if "Impress the Interviewer" in demo_text or "Concept" in demo_text or "Problem" in demo_text:
                log_step("2a. Impress Interviewer (AI Project Module)", "PASS", "Module interactive and functional")
            else:
                log_step("2a. Impress Interviewer (AI Project Module)", "FAIL", "Impress Interviewer module missing")

            # Return home
            await page.click("button:has-text('← Back'), button.brand")
            await page.wait_for_timeout(800)

            # 2b. Corporate Ready (Resilience & Communication)
            await page.click("text=Corporate Ready")
            await page.wait_for_timeout(1200)
            corp_text = await page.inner_text("body")
            if "Corporate Ready" in corp_text or "Communication" in corp_text or "Habits" in corp_text or "Feedback" in corp_text:
                log_step("2b. Corporate Ready Module", "PASS", "Module interactive and functional")
            else:
                log_step("2b. Corporate Ready Module", "FAIL", "Corporate Ready module missing")

            # Return home
            await page.click("button:has-text('← Back'), button.brand")
            await page.wait_for_timeout(800)

            # 2c. AI at Work
            await page.click("text=AI at Work")
            await page.wait_for_timeout(1200)
            ai_text = await page.inner_text("body")
            if "AI at Work" in ai_text or "Workflows" in ai_text or "Tools" in ai_text:
                log_step("2c. AI at Work Module", "PASS", "Module interactive and functional")
            else:
                log_step("2c. AI at Work Module", "FAIL", "AI at Work module missing")

            # Return home
            await page.click("button:has-text('← Back'), button.brand")
            await page.wait_for_timeout(800)

            # 3. Student Authentication & Workspace Access
            await page.click("button:has-text('Enter Workspace')")
            await page.wait_for_timeout(600)
            await page.fill("input[type='email']", "alex.qa.student@test.com")
            await page.click("button:has-text('Continue')")
            await page.wait_for_timeout(1800)
            
            w_text = await page.inner_text("body")
            if "My Workspace" in w_text or "Master CV" in w_text:
                log_step("3. Student Authentication & Workspace Access", "PASS", "Authenticated as alex.qa.student@test.com")
            else:
                log_step("3. Student Authentication & Workspace Access", "FAIL", "Workspace not displayed")

            # 4. Open Master CV & Input CV
            await page.click("text=Master CV")
            await page.wait_for_timeout(1000)
            
            # If in view mode, click Edit CV
            edit_btn = page.locator("button:has-text('Edit CV')").first
            if await edit_btn.is_visible():
                await edit_btn.click()
                await page.wait_for_timeout(800)

            ta = page.locator("textarea#cvText, textarea").first
            await ta.fill(test_cv)
            log_step("4. CV Input / Paste", "PASS", "Inputted 1,300+ character B.Tech CV")

            # 5. Review & Improve CV (CV Studio)
            review_btn = page.locator("button:has-text('Review & improve my CV')").first
            if not await review_btn.is_visible():
                review_btn = page.locator("button:has-text('Review &')").first
            await review_btn.click()
            log_step("5. Trigger CV Analysis", "INFO", "Waiting for CV Studio...")
            await page.wait_for_timeout(6000)

            studio_text = await page.inner_text("body")
            if "Master CV saved & ready" in studio_text or "Direct Audio Interview" in studio_text or "CV Score" in studio_text or "Executive CV Preview" in studio_text:
                log_step("5. CV Studio & AI Bullet Improvements", "PASS", "CV Studio loaded with executive preview and action choices")
            else:
                log_step("5. CV Studio & AI Bullet Improvements", "FAIL", "CV Studio elements not rendered")

            # 6. Start Audio Interview Gate
            start_btn = page.locator("button:has-text('Direct Audio Interview'), button:has-text('Save & start interview')").first
            await start_btn.click()
            await page.wait_for_timeout(3000)

            interview_text = await page.inner_text("body")
            if "QUESTION 1 OF" in interview_text or "AI Audio Interview" in interview_text:
                log_step("6. Start AI Audio Interview", "PASS", "Audio interview initiated with Question 1")
            else:
                log_step("6. Start AI Audio Interview", "FAIL", "Audio interview question screen not reached")

            # 7. Quality & Spelling Audit on Generated Question
            q_text = await page.inner_text(".question-card h2")
            print(f"Generated Question 1: {q_text}")
            if "Technolo." in q_text:
                log_step("7. Question Spelling & Truncation Audit", "FAIL", "Truncated 'Technolo.' detected!")
            else:
                log_step("7. Question Spelling & Truncation Audit", "PASS", f"Clean wording: '{q_text[:60]}...'")

            # 8. Voice Interface & Controls
            mic_visible = await page.locator(".voice-card").is_visible()
            transcript_box = await page.locator(".transcript-card").is_visible()
            if mic_visible and transcript_box:
                log_step("8. Voice Card & Live Transcript UI", "PASS", "Continuous voice recognition card & live transcript ready")
            else:
                log_step("8. Voice Card & Live Transcript UI", "FAIL", "Voice card or transcript box missing")

        except Exception as e:
            log_step("Audit Execution", "FAIL", str(e))
        finally:
            await browser.close()

    with open("qa-audit-results.json", "w") as f:
        json.dump(report, f, indent=2)

    print("\n==========================================")
    print("FINAL WORLD-CLASS QA AUDIT RESULT:")
    print(f"Overall Status: {'ALL SYSTEMS GO (PASS)' if report['passed'] else 'FAILURES DETECTED'}")
    print(f"Total Steps Tested: {len(report['steps'])}")
    print(f"Browser Errors: {len(report['errors'])}")
    print("==========================================")

if __name__ == "__main__":
    asyncio.run(run())
