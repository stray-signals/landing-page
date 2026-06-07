module.exports = function(eleventyConfig) {

  // Converts YYYY-MM-DD to a full RFC 3339 timestamp for Atom feeds
  eleventyConfig.addFilter('toRfc3339', (dateStr) => {
    return new Date(dateStr + 'T00:00:00Z').toISOString();
  });


  // Static assets — copied straight through, no processing
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("avatar");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("terminal");
  eleventyConfig.addPassthroughCopy("media");
  eleventyConfig.addPassthroughCopy("transmissions/log.json");
  eleventyConfig.addPassthroughCopy("CNAME");

  // Main site HTML — pass through, don't process as templates
  eleventyConfig.ignores.add("index.html");
  eleventyConfig.ignores.add("404.html");
  eleventyConfig.addPassthroughCopy("index.html");
  eleventyConfig.addPassthroughCopy("404.html");

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
