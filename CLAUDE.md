# CLAUDE.md: lizlemarchand.com

This is Liz Lemarchand's website (Lemarchand: one word, no capital M). It's a static site on Netlify. Pushing to `main` on GitHub (lizlemarchand/lizlemarchand-site) deploys it live, so always ask Liz before you push.

## Who Liz is
Certified NLP life coach with 25 years in sales and marketing. Founder of the Skool community **Money & Growth for Women**. She helps women in business stop swinging between **bulldozer** and **people pleaser** and land in the **calm, confident middle**. She is not a "sales coach"; she helps women sell with calm confidence and self-worth.

Voice: casual, funny (she does stand-up), real, direct, warm. Never pushy, never bro-marketing, never fake.

## The non-negotiable rule: Clear. Kind. True.
Every word on this site is written in Liz's name and must pass Clear. Kind. True.
- **Clear:** say what you mean. No vague language, over-explaining, or apologizing.
- **Kind:** respect her and the reader. Kind is not agreeable or soft.
- **True:** stand behind it. No seeking permission, no minimizing value.

### Banned permission signals (never write these in Liz's voice)
- "no pressure", "no-pressure", "no pitch"
- "when you're ready", "whenever you're ready", "upgrade when you're ready"
- "if it feels right", "only if it feels right", "totally up to you"
- "feel free to", "just checking in", "no obligation", "sorry to bother"
- "it might be worth a look", "it might be time to", "what are you waiting for?"
- Apologizing for the price, discounting before anyone asks

Exception: blog posts that **teach** against these phrases (for example "Stop Saying 'No Pressure' on Sales Calls") may quote them. Quoting to teach is fine; using them is not.

Instead: name the offer, what it does for her, and the price, then give one clear next step (a button or a yes/no question).

## Every page and CTA
- One clear next step per section. A button beats a vague link.
- Name prices plainly: Standard $5/year, Premium $37/month or $347/year, VIP $275/month.
- Never call the community "free". Joining is Standard at $5/year. The lead magnets (Decoder, Audit, quiz) are free.
- The method is always written in this order: **Clear. Kind. True.** (never "Kind, Clear, and True").
- Blog post CTAs point to the Sales Conversation Decoder.
- The archetype quiz is retired (Nov 2026). The front door is the Sales Freeze Scorecard (sales-freeze-scorecard.html), which keeps the Netlify form name "archetype-quiz-leads" so the systeme.io connection and "Website Quiz" tag keep working. Never rename that form.
- **The Sales Conversation Decoder is the front-door lead magnet.** Feature it over the archetype quiz. The quiz stays live but is never the most prominent offer.

## Lead magnets and email (systeme.io)
Forms are Netlify Forms; contacts land in systeme.io with a tag:
- Sales Conversation Decoder → tag "Sales Conversation Decoder"
- Permission Signals Audit → tag "Permission Signals Audit"
- Archetype quiz → tag "Website Quiz"
- Newsletter → tag "Newsletter"
systeme.io plan caps automation rules at 10, so check before adding a new tag-triggered sequence.

## The Permission Signals Detector
Premium-only tool at permission-signals.html, gated by password. Analysis runs through Netlify functions (`netlify/functions/analyze-*`) as a background job.

## Before you finish any change
1. Search the changed files for the banned phrases above.
2. Read every CTA aloud: does it say what she gets and what to do next?
3. Show Liz the diff. Push only when she says so.
