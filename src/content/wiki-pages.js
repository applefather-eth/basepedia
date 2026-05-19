const markdownFiles = import.meta.glob("./tokens/*/index.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

const metaFiles = import.meta.glob("./tokens/*/meta.json", {
  eager: true,
  import: "default",
});

function slugFromPath(path) {
  return path.match(/\.\/tokens\/([^/]+)\//)?.[1];
}

export const wikiPages = Object.fromEntries(
  Object.entries(markdownFiles)
    .map(([path, markdown]) => {
      const slug = slugFromPath(path);
      if (!slug) return null;

      const meta = metaFiles[`./tokens/${slug}/meta.json`] ?? {};
      return [
        slug,
        {
          ...meta,
          slug,
          markdown,
        },
      ];
    })
    .filter(Boolean),
);
