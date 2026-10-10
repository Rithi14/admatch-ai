import { runDemoAnalysis } from './demoAuditEngine.js';

/**
 * Example inputs used by (a) the "Load an example" picker on the New Audit page and
 * (b) the built-in sample audits. All brands and URLs are fictitious.
 */
export const EXAMPLE_INPUTS = [
  {
    key: 'shoes',
    label: 'Running shoes sale (clear mismatches)',
    headline: 'Get 50% Off Running Shoes – Today Only',
    body: 'Premium running shoes for every runner. Free shipping on all orders. 30-day money-back guarantee.',
    cta: 'Shop Now',
    url: 'https://www.stridelab.example/summer-sale',
    audience: 'Recreational runners',
    goal: 'sales',
    industry: 'E-commerce',
    pageText:
      'StrideLab Running Shoes. Shop our new season collection. Save up to 20% on selected styles. Shipping is free on orders over $75. Every pair is tested by real runners. Returns are accepted within 14 days of delivery. Add to cart to reserve your size.',
  },
  {
    key: 'saas',
    label: 'Project management SaaS (well aligned)',
    headline: 'Project Management Software for Remote Teams',
    body: 'Plan sprints, track tasks and collaborate with your remote team in one place. 14-day free trial. No credit card required.',
    cta: 'Start Free Trial',
    url: 'https://www.tasknest.example/remote-teams',
    audience: 'Remote team managers',
    goal: 'signups',
    industry: 'SaaS / software',
    pageText:
      'TaskNest is project management software built for remote teams. Plan sprints, track tasks and collaborate with your remote team in one place. Start Free Trial and get a 14-day free trial of every feature. No credit card required. Connect Slack and Google Calendar in two clicks. Trusted by 4,000 teams worldwide. Read customer reviews and case studies. Cancel anytime. Questions? Contact our support team or read our privacy policy.',
  },
  {
    key: 'course',
    label: 'Online Python course (mixed results)',
    headline: 'Learn Python in 30 Days – Certified Course',
    body: 'Beginner friendly Python bootcamp with live mentors. Build 10 real projects. Get a certificate when you finish.',
    cta: 'Enroll Today',
    url: 'https://www.codecamp.example/python',
    audience: 'Career changers',
    goal: 'leads',
    industry: 'Education',
    pageText:
      'CodeCamp Python Course. Learn Python at your own pace with video lessons. Includes 4 mini projects and a community forum. Mentor office hours are available on the premium plan. Completion badge awarded after the final quiz. Register for the next cohort.',
  },
  {
    key: 'skincare',
    label: 'Organic skincare kit (mostly aligned)',
    headline: 'Organic Skincare Starter Kit – Free Shipping',
    body: 'Dermatologist tested organic skincare for sensitive skin. 100% organic ingredients.',
    cta: 'Order Now',
    url: 'https://www.glowleaf.example/starter-kit',
    audience: 'Adults with sensitive skin',
    goal: 'sales',
    industry: 'Health & wellness',
    pageText:
      'GlowLeaf Organic Skincare Starter Kit. Free shipping on every kit. Dermatologist tested and gentle on sensitive skin. Made with certified organic ingredients and no synthetic fragrance. Order now and join thousands of happy customers. Read our reviews. 30-day returns on unopened kits. Contact us any time.',
  },
];

/** Converts an example into the field values used by the audit form. */
export function exampleToFormValues(example) {
  const { key, label, ...fields } = example; // eslint-disable-line no-unused-vars
  return fields;
}

const DAY = 86400000;
const OFFSETS_MS = [2 * 3600000, 1 * DAY + 4 * 3600000, 3 * DAY, 6 * DAY];

/** Builds sample audits by running the demo engine. They are flagged `isSample`. */
export function buildSampleAudits(now = Date.now()) {
  return EXAMPLE_INPUTS.map((example, index) => {
    const audit = runDemoAnalysis(example, {
      now: new Date(now - OFFSETS_MS[index % OFFSETS_MS.length]),
      id: `sample_${example.key}`,
    });
    return { ...audit, isSample: true };
  });
}
