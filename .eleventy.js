const { DateTime } = require("luxon");
const markdownIt = require("markdown-it");

module.exports = function(eleventyConfig) {
  // Allow raw HTML in markdown files (needed since content is extracted as HTML)
  const md = markdownIt({ html: true, breaks: false, linkify: false });
  eleventyConfig.setLibrary("md", md);

  // Passthrough copies
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy({ "src/assets/css/main.css": "assets/css/main.css" });
  eleventyConfig.addPassthroughCopy("src/_redirects");

  // Dev server options
  eleventyConfig.setServerOptions({
    port: 8181,
  });

  // Watch CSS for changes
  eleventyConfig.addWatchTarget("src/assets/css/");

  // Collections
  eleventyConfig.addCollection("blog", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/content/blog/*.md")
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("projects", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/content/projects/*.md");
  });

  eleventyConfig.addCollection("videos", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/content/videos/*.md");
  });

  eleventyConfig.addCollection("testimonials", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/content/testimonials/*.md");
  });

  eleventyConfig.addCollection("pages", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/content/pages/*.md");
  });

  eleventyConfig.addCollection("pictures", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/content/pictures/*.md");
  });

  // Filters
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("LLLL d, yyyy");
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("rssDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("EEE, dd LLL yyyy HH:mm:ss +0000");
  });

  // JSON-safe string serialiser for use inside <script type="application/ld+json"> blocks.
  // Escapes <, > and & so the value is safe to embed in HTML without double-encoding.
  eleventyConfig.addFilter("toJSON", (value) => {
    return JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
  });

  eleventyConfig.addGlobalData("buildYear", () => new Date().getFullYear());

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"]
  };
};
