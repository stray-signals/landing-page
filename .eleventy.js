module.exports = function(eleventyConfig) {

  // Converts YYYY-MM-DD to a full RFC 3339 timestamp for Atom feeds
  eleventyConfig.addFilter('toRfc3339', (dateStr) => {
    return new Date(dateStr + 'T00:00:00Z').toISOString();
  });


  // Static assets - copied straight through, no processing
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("avatar");
  eleventyConfig.addPassthroughCopy("scripts");
  eleventyConfig.addPassthroughCopy("terminal");
  eleventyConfig.addPassthroughCopy("root/media");
  eleventyConfig.addPassthroughCopy("root/transmissions/log.json");
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("favicon.png");

  // Main site HTML - pass through, don't process as templates
  eleventyConfig.ignores.add("index.html");
  eleventyConfig.ignores.add("404.html");
  eleventyConfig.ignores.add("spritesheet.html");
  eleventyConfig.addPassthroughCopy("index.html");
  eleventyConfig.addPassthroughCopy("404.html");
  eleventyConfig.addPassthroughCopy("spritesheet.html");

  // Project pages - remap root/projects → /projects/
  eleventyConfig.addPassthroughCopy({ "root/projects/stray-console.js": "projects/stray-console.js" });

  // Pigeonhole and ROAM pitch pages - root/projects/{pigeonhole,roam} are
  // submodules (sparse-checked-out to just site/) pointing at their product
  // repos, so each page lives alongside the product it describes. Only
  // publish site/ - not the submodules' other tracked files (LICENSE,
  // README.md, etc).
  eleventyConfig.addPassthroughCopy({ "root/projects/pigeonhole/site": "projects/pigeonhole" });
  eleventyConfig.addPassthroughCopy({ "root/projects/roam/site": "projects/roam" });

  return {
    templateFormats: ["njk"],   // only .njk files are treated as templates
    dir: {
      input:    ".",
      output:   "_site",
      includes: "_includes",
      data:     "_data",
    },
  };
};
