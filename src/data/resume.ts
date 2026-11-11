/**
 * All of the site's content lives in this file.
 * Edit text here; the layout code reads from it and doesn't need to change.
 */

export type SkillId =
  | "power-bi"
  | "tableau"
  | "sql"
  | "snowflake"
  | "excel"
  | "alteryx"
  | "python"
  | "aws"
  | "snowflake-cortex"
  | "copilot-studio"
  | "llm"
  | "power-apps"
  | "power-automate"
  | "dataverse"
  | "salesforce"
  | "azure-devops"
  | "react"
  | "financial-modeling"
  | "pricing-strategy"
  | "ab-testing"
  | "agile"
  | "requirements";

export type Skill = { id: SkillId; name: string };
export type SkillGroup = { name: string; description: string; skills: Skill[] };

export type Bullet = {
  id: string;
  text: string;
  skills: SkillId[];
};

export type Role = {
  title: string;
  team: string;
  start: string;
  end: string;
  bullets: Bullet[];
};

export type Highlight = {
  /** Short figure shown on the terrain peak, e.g. "$300K". */
  value: string;
  /** What the figure means, in a few words. */
  label: string;
  /** Relative height of the peak, 0–1. */
  weight: number;
  /** The bullet (or project) this result comes from; clicking the peak scrolls there. */
  target: string;
};

export const profile = {
  name: "Nishant Kannan",
  role: "Business Intelligence and Data Science Professional",
  tagline:
    "I turn complex business data into the insights, tools and AI workflows that help organizations grow revenue and work smarter.",
  about: [
    "I help businesses make better decisions, faster. My work sits where data, technology and strategy meet: taking information scattered across ERPs, CRMs and spreadsheets and turning it into dashboards, models and AI-driven tools that people rely on every day.",
    "Over the past four years I've partnered with pricing, sales, finance, marketing, engineering, IT and operations teams to replace slow, manual processes with automated systems, sharpen pricing and revenue strategy, and give leaders clear visibility into where the opportunity is. That work has delivered millions in sales growth and hundreds of thousands of dollars a year in recovered labor.",
    "I start with the business problem, not the technology. A background in pricing and finance means I understand the numbers behind every decision, and hands-on depth in SQL, Snowflake, Power BI, Python and generative AI means I can take a solution from idea to adoption myself. I'm at my best when a project removes a bottleneck for good.",
  ],
  linkedin: "https://www.linkedin.com/in/nishant-kannan/",
  github: "https://github.com/nishantkannan",
  resumePdf: "/resume.pdf",
};

export const highlights: Highlight[] = [
  { value: "$800M+", label: "parts portfolio managed", weight: 1, target: "b-portfolio" },
  { value: "$300K/yr", label: "engineering labor eliminated", weight: 0.86, target: "b-ai-framework" },
  { value: "$1.9M+", label: "projected sales growth", weight: 0.74, target: "b-pricing-reviews" },
  { value: "+13%", label: "portfolio revenue in two years", weight: 0.64, target: "b-opportunity" },
  { value: "40%", label: "faster inquiry responses", weight: 0.56, target: "b-crm" },
  { value: "2nd / 38", label: "teams at the GRID hackathon", weight: 0.5, target: "project-grid" },
  { value: "<1%", label: "claim processing errors", weight: 0.44, target: "b-claims" },
];

export const skillGroups: SkillGroup[] = [
  {
    name: "Data and BI",
    description: "Modeling, querying and reporting",
    skills: [
      { id: "power-bi", name: "Power BI" },
      { id: "sql", name: "SQL" },
      { id: "snowflake", name: "Snowflake" },
      { id: "tableau", name: "Tableau" },
      { id: "excel", name: "Excel" },
      { id: "alteryx", name: "Alteryx" },
    ],
  },
  {
    name: "AI and cloud",
    description: "Agents, LLM workflows and pipelines",
    skills: [
      { id: "snowflake-cortex", name: "Snowflake Cortex" },
      { id: "aws", name: "AWS" },
      { id: "copilot-studio", name: "Copilot Studio" },
      { id: "llm", name: "LLM workflows" },
      { id: "python", name: "Python (pandas, NumPy, scikit-learn)" },
      { id: "react", name: "React" },
    ],
  },
  {
    name: "Apps and automation",
    description: "Tools that replace email-and-spreadsheet processes",
    skills: [
      { id: "power-apps", name: "Power Apps" },
      { id: "power-automate", name: "Power Automate" },
      { id: "dataverse", name: "Dataverse" },
      { id: "salesforce", name: "Salesforce CRM" },
      { id: "azure-devops", name: "Azure DevOps" },
    ],
  },
  {
    name: "Business methods",
    description: "How the work gets scoped and judged",
    skills: [
      { id: "pricing-strategy", name: "Pricing strategy" },
      { id: "financial-modeling", name: "Financial modeling" },
      { id: "ab-testing", name: "A/B testing" },
      { id: "requirements", name: "Requirements, QA and UAT" },
      { id: "agile", name: "Agile" },
    ],
  },
];

export const experience: { company: string; roles: Role[] } = {
  company: "Caterpillar Inc.",
  roles: [
    {
      title: "Business Intelligence Analyst",
      team: "Global Financial Services Division",
      start: "Jun 2025",
      end: "Present",
      bullets: [
        {
          id: "b-ai-framework",
          text: "Eliminated $300K a year of engineering labor by architecting an AI framework in Snowflake Cortex and AWS that standardizes and cleans competitive intelligence data, so markets can be compared feature by feature.",
          skills: ["snowflake-cortex", "aws", "snowflake", "llm", "sql"],
        },
        {
          id: "b-agent",
          text: "Removed analyst bottlenecks on pricing and compliance questions by building and training an AI agent in Copilot Studio that became the central source of pricing information.",
          skills: ["copilot-studio", "llm"],
        },
        {
          id: "b-claims",
          text: "Kept claim processing errors under 1% of all discounting claims with an LLM-based workflow that flags duplicate, incomplete or incorrectly valued credits and debits.",
          skills: ["llm", "snowflake", "sql"],
        },
        {
          id: "b-approvals",
          text: "Automated a pricing approval process of 25+ requests a month, previously run on Excel, PowerPoint and email, with a Power App that handles the approval flow, data queries, impact summary and record logging.",
          skills: ["power-apps", "power-automate", "dataverse", "excel"],
        },
        {
          id: "b-dashboards",
          text: "Built and manage a suite of Power BI dashboards, with adoption plans, that consolidate ERP, invoicing and CRM data in Snowflake for on-demand reporting on revenue, discount spend, profitability and global opportunity.",
          skills: ["power-bi", "snowflake", "sql"],
        },
        {
          id: "b-crossfunctional",
          text: "Lead cross-functional analytics requests across Pricing, Sales, IT and Marketing: turning requirements into Azure DevOps work, mapping processes, and running QA and UAT through to adoption.",
          skills: ["azure-devops", "requirements", "agile"],
        },
      ],
    },
    {
      title: "Revenue Analyst",
      team: "Global Parts Pricing",
      start: "Aug 2022",
      end: "Jun 2025",
      bullets: [
        {
          id: "b-crm",
          text: "Cut average customer and dealer inquiry response time by 40% by leading the rollout of Salesforce CRM for 500+ monthly inquiries, including the requirements and user adoption plan.",
          skills: ["salesforce", "requirements"],
        },
        {
          id: "b-portfolio",
          text: "Oversaw the strategic and financial direction of a parts portfolio of more than $800M in revenue, using inflation analysis, market and competitive research, and sales data.",
          skills: ["pricing-strategy", "financial-modeling", "excel", "sql"],
        },
        {
          id: "b-dealer-requests",
          text: "Sped up pricing request turnaround by consolidating 8,000+ dealer requests into a stakeholder-facing dashboard.",
          skills: ["power-bi", "sql"],
        },
        {
          id: "b-pricing-reviews",
          text: "Generated $1.9M+ in projected global sales growth by leading 7+ strategic pricing reviews that aligned discounts with market demand, competitive benchmarks and customer value.",
          skills: ["pricing-strategy", "financial-modeling"],
        },
        {
          id: "b-opportunity",
          text: "Grew global revenue for my portfolio by 13% over two years with an Opportunity Tracker in Power BI and SQL that shows sales where opportunity is high and lost sales are rising.",
          skills: ["power-bi", "sql"],
        },
        {
          id: "b-launches",
          text: "Worked across Sales, IT, Engineering, Operations and Marketing on launch plans that brought new products into markets worldwide.",
          skills: ["requirements"],
        },
      ],
    },
    {
      title: "Parts Pricing Intern",
      team: "Global Parts Pricing",
      start: "May 2022",
      end: "Aug 2022",
      bullets: [
        {
          id: "b-contracts",
          text: "Reconciled 3 major account contracts using Excel financial models that simulated the impact of price changes.",
          skills: ["excel", "financial-modeling"],
        },
        {
          id: "b-price-changes",
          text: "Deployed 40+ price changes to correct errors and respond to inflation and sudden demand shifts.",
          skills: ["pricing-strategy"],
        },
        {
          id: "b-orders",
          text: "Built an order tracking dashboard in SQL and Power BI covering about 15K purchase orders a month to catch shipping and delivery delays.",
          skills: ["power-bi", "sql"],
        },
      ],
    },
  ],
};

export const projects = [
  {
    id: "project-grid",
    name: "Caterpillar GRID Hackathon",
    date: "Jun 2026",
    result: "2nd of 38 teams",
    text: "Built a React web app that surfaces the highest-opportunity construction and mining projects worldwide, with an AI agent that predicts high-value customers and charts of competitive data, regional project value and sales priorities.",
    skills: ["react", "llm"] as SkillId[],
  },
];

export const education = {
  school: "University of Arizona, Eller College of Management",
  location: "Tucson, AZ",
  degree: "Bachelor of Science in Business Administration",
  minor: "Statistics and Data Science",
  honors: [
    "National Merit Finalist Scholarship",
    "National AP Scholar",
    "Dean's List (2020, 2021, 2022)",
  ],
};

export const certifications = [
  { name: "Project Management 101/102", year: "2025" },
  { name: "Olympus Analytics in Finance", year: "2022" },
  { name: "Udacity SQL for Data Analysis", year: "2022" },
  { name: "Google Analytics", year: "2021" },
];
