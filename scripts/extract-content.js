#!/usr/bin/env node
/**
 * Content extraction script: Drupal HTML export → 11ty Markdown
 * Reads from ../html/ and writes to ../src/content/
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const HTML_ROOT = path.join(__dirname, "../../html");
const CONTENT_ROOT = path.join(__dirname, "../src/content");

// ── helpers ──────────────────────────────────────────────────────────────────

function readHtml(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Strip deeply-nested Drupal <span> wrappers but keep inner text/HTML */
function cleanBody($, el) {
  // Remove data-entity-* attrs from img tags (keep src, alt, width, height)
  $(el).find("img").each((_, img) => {
    const $img = $(img);
    $img.removeAttr("data-entity-type");
    $img.removeAttr("data-entity-uuid");
    // Rewrite /sites/default/files/ paths to /assets/images/
    const src = $img.attr("src") || "";
    $img.attr("src", rewriteImagePath(src));
  });

  // Unwrap redundant nested spans (Drupal adds 6 levels deep)
  let changed = true;
  while (changed) {
    changed = false;
    $(el).find("span").each((_, span) => {
      const $span = $(span);
      // If span has no class/id/style, unwrap it
      if (!$span.attr("class") && !$span.attr("id") && !$span.attr("style")) {
        $span.replaceWith($span.html());
        changed = true;
      }
    });
  }

  // Rewrite internal image srcs in body
  $(el).find("img").each((_, img) => {
    const $img = $(img);
    const src = $img.attr("src") || "";
    $img.attr("src", rewriteImagePath(src));
  });

  return $(el).html() || "";
}

function rewriteImagePath(src) {
  // Strip ?itok=... query strings first
  src = src.replace(/\?itok=[^&?]+/, "");

  // /sites/default/files/styles/cid_photo_gallery_thumbs/public/portfolio-picts/ → /assets/images/thumbnails/portfolio-picts/
  src = src.replace(/\/sites\/default\/files\/styles\/cid_photo_gallery_thumbs\/public\/portfolio-picts\//, "/assets/images/thumbnails/portfolio-picts/");
  // /sites/default/files/styles/XXX/public/portfolio-picts/ → /assets/images/portfolio-picts/
  src = src.replace(/\/sites\/default\/files\/styles\/[^/]+\/public\/portfolio-picts\//, "/assets/images/portfolio-picts/");
  // /sites/default/files/styles/XXX/public/youtube/ → /assets/images/youtube/
  src = src.replace(/\/sites\/default\/files\/styles\/[^/]+\/public\/youtube\//, "/assets/images/youtube/");
  // Any remaining styled path
  src = src.replace(/\/sites\/default\/files\/styles\/[^/]+\/public\//, "/assets/images/");
  // /sites/default/files/inline-images/ → /assets/images/inline-images/
  src = src.replace(/\/sites\/default\/files\/inline-images\//, "/assets/images/inline-images/");
  // /sites/default/files/portfolio-picts/ → /assets/images/portfolio-picts/
  src = src.replace(/\/sites\/default\/files\/portfolio-picts\//, "/assets/images/portfolio-picts/");
  // /sites/default/files/FILE → /assets/images/FILE
  src = src.replace(/\/sites\/default\/files\//, "/assets/images/");
  return src;
}

function rewriteInternalLinks(html) {
  // Rewrite /node/NNN links - can't resolve these without a map, leave as-is
  // Rewrite /basement-content/blog/SLUG → /blog/SLUG
  return html
    .replace(/href="\/basement-content\/blog\//g, 'href="/blog/')
    .replace(/href="\/basement-content\//g, 'href="/pages/');
}

function writeMarkdown(filePath, frontmatter, bodyHtml) {
  const lines = ["---"];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (val === null || val === undefined) continue;
    if (typeof val === "string") {
      const escaped = val.replace(/"/g, '\\"').replace(/\n/g, " ");
      lines.push(`${key}: "${escaped}"`);
    } else if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) {
        if (typeof item === "object" && item !== null) {
          // Write as YAML object block
          let first = true;
          for (const [k, v] of Object.entries(item)) {
            const escaped = String(v).replace(/"/g, '\\"');
            lines.push(`${first ? "  - " : "    "}${k}: "${escaped}"`);
            first = false;
          }
        } else {
          lines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
        }
      }
    } else if (typeof val === "boolean") {
      lines.push(`${key}: ${val}`);
    } else if (typeof val === "number") {
      lines.push(`${key}: ${val}`);
    } else {
      lines.push(`${key}: "${String(val).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push("---");
  lines.push("");
  if (bodyHtml) {
    lines.push(rewriteInternalLinks(bodyHtml));
  }

  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  console.log("  ✓", path.relative(CONTENT_ROOT, filePath));
}

// ── extractors ───────────────────────────────────────────────────────────────

function extractTitle($) {
  return $("h1 span").first().text().trim() || $("h1").first().text().trim() || $("title").text().split("|")[0].trim();
}

function extractMeta($) {
  return $('meta[name="description"]').attr("content") || "";
}

/** Extract main article body (excluding sidebar) */
function extractArticleBody($) {
  const article = $("article .node__content .region").first();
  if (article.length) return cleanBody($, article);
  // fallback: first .region in main content
  const main = $("#main-content-section .region").first();
  if (main.length) return cleanBody($, main);
  return "";
}

// ── BLOG posts ───────────────────────────────────────────────────────────────

function extractBlog() {
  const blogDir = path.join(HTML_ROOT, "basement-content/blog");
  if (!fs.existsSync(blogDir)) return;

  const entries = fs.readdirSync(blogDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  console.log(`\nExtracting ${entries.length} blog posts...`);

  for (const entry of entries) {
    const htmlFile = path.join(blogDir, entry.name, "index.html");
    const html = readHtml(htmlFile);
    if (!html) continue;

    const $ = cheerio.load(html);
    const title = extractTitle($);
    const description = extractMeta($);
    const body = extractArticleBody($);
    const slug = entry.name;

    writeMarkdown(
      path.join(CONTENT_ROOT, "blog", `${slug}.md`),
      {
        title,
        description,
        layout: "layouts/blog.njk",
        permalink: `/blog/${slug}/index.html`,
        eleventyNavigation: false,
      },
      body
    );
  }
}

// ── PROJECTS ─────────────────────────────────────────────────────────────────

function extractProjects() {
  const projectsDir = path.join(HTML_ROOT, "projects");
  if (!fs.existsSync(projectsDir)) return;

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  console.log(`\nExtracting ${entries.length} projects...`);

  for (const entry of entries) {
    const htmlFile = path.join(entry.name === "index.html" ? projectsDir : path.join(projectsDir, entry.name), "index.html");
    const html = readHtml(htmlFile);
    if (!html) continue;

    const $ = cheerio.load(html);
    const title = extractTitle($);
    const description = extractMeta($);

    // Extract body text
    const bodyEl = $("article .region").first();
    const body = bodyEl.length ? cleanBody($, bodyEl) : "";

    // Extract Google Map coordinates
    const mapContainer = $(".map-container");
    const mapLat = mapContainer.attr("data-lat") || "";
    const mapLon = mapContainer.attr("data-lon") || "";
    const mapTitle = $(".google-map-field h2").text().trim() || "";

    // Extract sidebar gallery images
    const images = [];
    $("#block-views-block-project-picture-sidebar-block-1 .views-row").each((_, row) => {
      const $row = $(row);
      // Get the large image href (colorbox link)
      const href = $row.find("a.colorbox").attr("href") || "";
      const alt = $row.find("img").attr("alt") || "";
      const thumb = $row.find("img").attr("src") || "";
      if (href || thumb) {
        images.push({
          src: rewriteImagePath(href || thumb),
          thumb: rewriteImagePath(thumb),
          alt,
        });
      }
    });

    // Check for page 2 images as well
    const page2File = path.join(projectsDir, entry.name, "page/2/index.html");
    const html2 = readHtml(page2File);
    if (html2) {
      const $2 = cheerio.load(html2);
      $2("#block-views-block-project-picture-sidebar-block-1 .views-row").each((_, row) => {
        const $row = $2(row);
        const href = $row.find("a.colorbox").attr("href") || "";
        const alt = $row.find("img").attr("alt") || "";
        const thumb = $row.find("img").attr("src") || "";
        if (href || thumb) {
          images.push({
            src: rewriteImagePath(href || thumb),
            thumb: rewriteImagePath(thumb),
            alt,
          });
        }
      });
    }

    // Hero image: first image in colorbox or front image
    const heroSrc = images.length > 0 ? images[0].src : "";

    writeMarkdown(
      path.join(CONTENT_ROOT, "projects", `${entry.name}.md`),
      {
        title,
        description,
        layout: "layouts/project.njk",
        permalink: `/projects/${entry.name}/index.html`,
        heroImage: heroSrc,
        mapLat,
        mapLon,
        mapTitle,
        images,
      },
      body
    );
  }
}

// ── VIDEOS ───────────────────────────────────────────────────────────────────

function extractVideos() {
  const videosDir = path.join(HTML_ROOT, "basement-videos");
  if (!fs.existsSync(videosDir)) return;

  const entries = fs.readdirSync(videosDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  console.log(`\nExtracting ${entries.length} videos...`);

  for (const entry of entries) {
    const htmlFile = path.join(videosDir, entry.name, "index.html");
    const html = readHtml(htmlFile);
    if (!html) continue;

    const $ = cheerio.load(html);
    const title = extractTitle($);

    // Extract YouTube embed src
    const iframe = $("iframe").first();
    let youtubeId = "";
    if (iframe.length) {
      const src = iframe.attr("src") || "";
      const match = src.match(/youtube\.com\/embed\/([^?&/]+)/);
      if (match) youtubeId = match[1];
    }

    // Extract body description (article body minus the iframe)
    const bodyEl = $("article .node__content .region, article .region").first();
    if (bodyEl.length) {
      // Remove the iframe wrapper to avoid duplicating it
      bodyEl.find("iframe").parent().parent().remove();
    }
    const body = bodyEl.length ? cleanBody($, bodyEl) : "";

    // Thumbnail
    const thumbnail = youtubeId ? `/assets/images/youtube/${youtubeId}.jpg` : "";

    writeMarkdown(
      path.join(CONTENT_ROOT, "videos", `${entry.name}.md`),
      {
        title,
        layout: "layouts/video.njk",
        permalink: `/basement-videos/${entry.name}/index.html`,
        youtubeId,
        thumbnail,
      },
      body
    );
  }
}

// ── TESTIMONIALS ─────────────────────────────────────────────────────────────

function extractTestimonials() {
  const htmlFile = path.join(HTML_ROOT, "testimonials/index.html");
  const html = readHtml(htmlFile);
  if (!html) return;

  const $ = cheerio.load(html);
  const rows = $(".views-infinite-scroll-content-wrapper .views-row");

  console.log(`\nExtracting ${rows.length} testimonials...`);

  let index = 1;
  rows.each((_, row) => {
    const $row = $(row);
    const bodyHtml = $row.find(".field-content").html() || "";
    // Try to extract author from last <p> containing "- Name"
    const text = $row.find(".field-content").text().trim();
    const authorMatch = text.match(/-\s*([A-Z][^\n]+)$/);
    const author = authorMatch ? authorMatch[1].trim() : "";

    writeMarkdown(
      path.join(CONTENT_ROOT, "testimonials", `testimonial-${index}.md`),
      {
        layout: "layouts/testimonial.njk",
        order: index,
        author,
      },
      bodyHtml
    );
    index++;
  });
}

// ── PAGES ─────────────────────────────────────────────────────────────────────

const PAGE_MAP = [
  {
    src: "basement-content/basement-finishing-and-remodeling-services/index.html",
    slug: "services",
    permalink: "/basement-content/basement-finishing-and-remodeling-services/index.html",
    navTitle: "Services",
  },
  {
    src: "basement-content/things-consider-when-comparing-general-contractors/index.html",
    slug: "contractors",
    permalink: "/basement-content/things-consider-when-comparing-general-contractors/index.html",
    navTitle: "Contractors",
  },
  {
    src: "basement-content/about-our-basement-finishing-remodeling-company/index.html",
    slug: "about",
    permalink: "/basement-content/about-our-basement-finishing-remodeling-company/index.html",
    navTitle: "About",
  },
  {
    src: "basement-content/basement-finishing-aurora-co/index.html",
    slug: "basement-finishing-aurora-co",
    permalink: "/basement-content/basement-finishing-aurora-co/index.html",
  },
  {
    src: "basement-content/basement-finishing-castle-rock-co/index.html",
    slug: "basement-finishing-castle-rock-co",
    permalink: "/basement-content/basement-finishing-castle-rock-co/index.html",
  },
  {
    src: "basement-content/basement-finishing-castle-pines-co/index.html",
    slug: "basement-finishing-castle-pines-co",
    permalink: "/basement-content/basement-finishing-castle-pines-co/index.html",
  },
  {
    src: "basement-content/basement-finishing-highlands-ranch/index.html",
    slug: "basement-finishing-highlands-ranch",
    permalink: "/basement-content/basement-finishing-highlands-ranch/index.html",
  },
  {
    src: "basement-finishing-parker-co/index.html",
    slug: "basement-finishing-parker-co",
    permalink: "/basement-finishing-parker-co/index.html",
  },
  {
    src: "basement-content/accessibility/index.html",
    slug: "accessibility",
    permalink: "/basement-content/accessibility/index.html",
  },
  {
    src: "basement-content/links/index.html",
    slug: "links",
    permalink: "/basement-content/links/index.html",
  },
  {
    src: "getting-started-basement-finishing/index.html",
    slug: "getting-started-basement-finishing",
    permalink: "/getting-started-basement-finishing/index.html",
  },
  {
    src: "perfect-basement-design/index.html",
    slug: "perfect-basement-design",
    permalink: "/perfect-basement-design/index.html",
  },
  {
    src: "low-ceiling-basement-finishing/index.html",
    slug: "low-ceiling-basement-finishing",
    permalink: "/low-ceiling-basement-finishing/index.html",
  },
  {
    src: "egress-window-requirements/index.html",
    slug: "egress-window-requirements",
    permalink: "/egress-window-requirements/index.html",
  },
  {
    src: "qualifies-finished-basement/index.html",
    slug: "qualifies-finished-basement",
    permalink: "/qualifies-finished-basement/index.html",
  },
  {
    src: "top-basement-design-trends/index.html",
    slug: "top-basement-design-trends",
    permalink: "/top-basement-design-trends/index.html",
  },
];

function extractPages() {
  console.log(`\nExtracting ${PAGE_MAP.length} content pages...`);

  for (const page of PAGE_MAP) {
    const htmlFile = path.join(HTML_ROOT, page.src);
    const html = readHtml(htmlFile);
    if (!html) {
      console.log(`  ⚠ skipped (not found): ${page.src}`);
      continue;
    }

    const $ = cheerio.load(html);
    const title = extractTitle($);
    const description = extractMeta($);
    const body = extractArticleBody($);

    writeMarkdown(
      path.join(CONTENT_ROOT, "pages", `${page.slug}.md`),
      {
        title,
        description,
        layout: "layouts/page.njk",
        permalink: page.permalink,
        navTitle: page.navTitle || null,
      },
      body
    );
  }
}

// ── HANDYMAN TIPS - just generate redirects ───────────────────────────────────
// handyman-tips/* pages are redirects to basement-content/blog/*
// We handle these via _redirects file, not by duplicating content.
function extractHandymanTips() {
  const tipsDir = path.join(HTML_ROOT, "handyman-tips");
  if (!fs.existsSync(tipsDir)) return;

  const entries = fs.readdirSync(tipsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  // Write Netlify _redirects entries
  let redirectLines = "";
  for (const entry of entries) {
    redirectLines += `/handyman-tips/${entry.name}/ /blog/${entry.name}/ 301\n`;
  }

  const publicDir = path.join(__dirname, "../src");
  fs.mkdirSync(publicDir, { recursive: true });
  const redirectsFile = path.join(publicDir, "_redirects");
  // Append to existing file if it exists
  if (fs.existsSync(redirectsFile)) {
    fs.appendFileSync(redirectsFile, "\n" + redirectLines);
  } else {
    fs.writeFileSync(redirectsFile, redirectLines);
  }
  console.log(`\n  ✓ _redirects (${entries.length} handyman-tips redirects)`);
}

// ── PICTURES gallery ─────────────────────────────────────────────────────────

function extractPictures() {
  // Extract individual picture pages from /finished-basements/
  const finishedDir = path.join(HTML_ROOT, "finished-basements");
  if (!fs.existsSync(finishedDir)) return;

  // The gallery is a views listing - get all portfolio images from the sidebar
  // Instead of extracting individual picture pages, we'll build a gallery data file
  const galleryImages = [];

  // Scan all project pages for their sidebar gallery images
  const projectsDir = path.join(HTML_ROOT, "projects");
  const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const proj of projects) {
    for (const pageNum of ["", "/page/2", "/page/3"]) {
      const htmlFile = path.join(projectsDir, proj.name, pageNum ? `${pageNum}/index.html` : "index.html");
      const html = readHtml(htmlFile);
      if (!html) continue;

      const $ = cheerio.load(html);
      $("#block-views-block-project-picture-sidebar-block-1 .views-row").each((_, row) => {
        const $row = $(row);
        const href = $row.find("a.colorbox").attr("href") || "";
        const alt = $row.find("img").attr("alt") || "";
        const thumb = $row.find("img").attr("src") || "";
        if (href || thumb) {
          const src = rewriteImagePath(href || thumb);
          if (!galleryImages.find(i => i.src === src)) {
            galleryImages.push({
              src,
              thumb: rewriteImagePath(thumb),
              alt,
              project: proj.name,
            });
          }
        }
      });
    }
  }

  // Get images from finished-basements listing pages (all pagination pages)
  const paginationDirs = ["index.html", ...fs.readdirSync(finishedDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !isNaN(parseInt(d.name)))
    .map(d => `${d.name}/index.html`)
  ];

  for (const pageFile of paginationDirs) {
    const htmlFile = path.join(finishedDir, pageFile);
    const html = readHtml(htmlFile);
    if (!html) continue;

    const $ = cheerio.load(html);
    $(".views-row").each((_, row) => {
      const $row = $(row);
      const anchor = $row.find("a.colorbox");
      const href = anchor.attr("href") || "";
      const img = $row.find("img");
      const alt = img.attr("alt") || "";
      const thumbSrc = img.attr("src") || "";
      const fullSrc = href || thumbSrc;
      if (fullSrc) {
        const cleanFull = rewriteImagePath(fullSrc);
        const cleanThumb = rewriteImagePath(thumbSrc || fullSrc);
        if (!galleryImages.find(i => i.src === cleanFull)) {
          galleryImages.push({ src: cleanFull, thumb: cleanThumb, alt, project: "" });
        }
      }
    });
  }

  console.log(`\nFound ${galleryImages.length} gallery images`);

  // Write as a JSON data file
  const dataDir = path.join(__dirname, "../src/_data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "gallery.json"),
    JSON.stringify(galleryImages, null, 2),
    "utf8"
  );
  console.log("  ✓ _data/gallery.json");
}

// ── SITE DATA ─────────────────────────────────────────────────────────────────

function writeSiteData() {
  const data = {
    title: "CID Basements",
    fullTitle: "Custom Integrated Designs Ltd.",
    slogan: "Take your basement to a new level",
    email: "info@cidbasements.com",
    phone: "(303) 591-7100",
    phoneRaw: "3035917100",
    analytics: "UA-198471-1",
    url: "https://www.cidbasements.com",
    year: 2017,
    nav: [
      { label: "Home", url: "/" },
      { label: "Services", url: "/basement-content/basement-finishing-and-remodeling-services/" },
      { label: "Contractors", url: "/basement-content/things-consider-when-comparing-general-contractors/" },
      { label: "Projects", url: "/projects/" },
      { label: "About", url: "/basement-content/about-our-basement-finishing-remodeling-company/" },
      { label: "Contact", url: "/contact/" },
    ],
    footerNav: [
      { label: "Contact", url: "/contact/" },
      { label: "Perfect BBB Rating", url: "https://www.bbb.org/us/co/parker/profile/basement-remodeling/custom-integrated-designs-ltd-1296-32715" },
      { label: "Links", url: "/basement-content/links/" },
      { label: "Blog", url: "/blog/" },
      { label: "Accessibility", url: "/basement-content/accessibility/" },
    ],
    serviceAreas: [
      { label: "Aurora", url: "/basement-content/basement-finishing-aurora-co/" },
      { label: "Castle Rock", url: "/basement-content/basement-finishing-castle-rock-co/" },
      { label: "Castle Pines areas", url: "/basement-content/basement-finishing-castle-pines-co/" },
      { label: "Elizabeth", url: null },
      { label: "Kiowa", url: null },
      { label: "Lone Tree", url: null },
      { label: "Parker", url: "/basement-finishing-parker-co/" },
    ],
    social: {
      facebook: "https://www.facebook.com/cidbasements",
      youtube: "https://www.youtube.com/channel/UCFrDtQFeCy2mE80kKGx7WkQ",
      twitter: "https://twitter.com/CIDbasements",
    },
    homeadvisor: "https://www.homeadvisor.com/rated.CustomIntegratedDesigns.34494601.html",
    bbb: "https://www.bbb.org/us/co/parker/profile/basement-remodeling/custom-integrated-designs-ltd-1296-32715",
    constructLogin: "https://www.co-construct.com/skins/cid/default.aspx",
    googleMapsUrl: "https://www.google.com/maps/place/Custom+Integrated+Designs+Ltd/@39.5693185,-105.0193694,10z/data=!4m7!3m6!1s0x876d225d4e37cf0f:0x869f62d9e2e2ea0e!8m2!3d39.5553497!4d-104.7189509!9m1!1b1",
    // Sidebar photos shown on most pages
    sidebarPhotos: [
      { src: "/assets/images/portfolio-picts/wine-cabinet-area-architectural-detail-nid127.jpg", alt: "Wine Cabinet Area with Architectural Detail" },
      { src: "/assets/images/portfolio-picts/custom-shelving-2-nid286.jpg", alt: "Custom Shelving 2" },
    ],
    // Sidebar videos shown on most pages
    sidebarVideos: [
      { youtubeId: "xaIoa7H_WRs", title: "Video #4: Finished Basement in Highlands Ranch, CO", url: "/basement-videos/video-4-finished-basement-highlands-ranch-co/" },
      { youtubeId: "koTOVhihLtE", title: "Video #1: Basement Finishing in Highlands Ranch, CO", url: "/basement-videos/video-1-basement-finishing-highlands-ranch-co/" },
    ],
    // Homepage hero image
    heroImage: {
      src: "/assets/images/portfolio-picts/basement-remodel-built-art-displays-custom-architectural-wood-detailing-2021-nid533.jpg",
      alt: "basement remodel with built in art displays, custom architectural wood detailing, 2021",
    },
  };

  const dataDir = path.join(__dirname, "../src/_data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "site.json"), JSON.stringify(data, null, 2), "utf8");
  console.log("\n  ✓ _data/site.json");
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

console.log("CID Basements — Content Extraction");
console.log("====================================");

writeSiteData();
extractBlog();
extractHandymanTips();
extractProjects();
extractVideos();
extractTestimonials();
extractPages();
extractPictures();

console.log("\n✅ Done!\n");
