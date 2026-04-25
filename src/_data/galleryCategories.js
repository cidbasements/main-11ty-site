const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const HTML_ROOT = path.join(__dirname, "../../../html");

const CATEGORIES = [
  { id: 2,  slug: "basement-architectural-details",    name: "Basement Architectural Details" },
  { id: 3,  slug: "basement-bars",                     name: "Basement Bars" },
  { id: 4,  slug: "basement-bathrooms",                name: "Basement Bathrooms" },
  { id: 5,  slug: "basement-media-rooms",              name: "Basement Media Rooms" },
  { id: 10, slug: "basement-offices",                  name: "Basement Offices" },
  { id: 7,  slug: "basement-stairs",                   name: "Basement Stairs" },
  { id: 8,  slug: "basement-wine-cellars-and-cabinets",name: "Basement Wine Cellars and Cabinets" },
  { id: 11, slug: "bathroom-remodels",                 name: "Bathroom Remodels" },
  { id: 12, slug: "kitchen-remodels",                  name: "Kitchen Remodels" },
  { id: 13, slug: "remodels",                          name: "Remodels" },
  { id: 6,  slug: "other",                             name: "Other" },
];

function rewriteImagePath(src) {
  src = src.replace(/\?itok=[^&?]+/, "");
  src = src.replace(/\/sites\/default\/files\/styles\/cid_photo_gallery_thumbs\/public\/portfolio-picts\//, "/assets/images/thumbnails/portfolio-picts/");
  src = src.replace(/\/sites\/default\/files\/styles\/[^/]+\/public\/portfolio-picts\//, "/assets/images/portfolio-picts/");
  src = src.replace(/\/sites\/default\/files\/styles\/[^/]+\/public\//, "/assets/images/");
  src = src.replace(/\/sites\/default\/files\//, "/assets/images/");
  return src;
}

module.exports = function () {
  return CATEGORIES.map((cat) => {
    const htmlFile = path.join(HTML_ROOT, "finished-basements", String(cat.id), "index.html");
    const images = [];

    if (fs.existsSync(htmlFile)) {
      const $ = cheerio.load(fs.readFileSync(htmlFile, "utf8"));
      $(".views-row").each((_, row) => {
        const anchor = $(row).find("a.colorbox");
        const img = $(row).find("img");
        const fullSrc = rewriteImagePath(anchor.attr("href") || img.attr("src") || "");
        const thumb = rewriteImagePath(img.attr("src") || "");
        const alt = img.attr("alt") || "";
        if (fullSrc) images.push({ src: fullSrc, thumb, alt });
      });
    }

    return { ...cat, images };
  });
};
