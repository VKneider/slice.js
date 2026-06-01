// Template registry: only the AppComponents the starter ships in-tree.
// Visual and Service components are installed from the registry by `slice init`
// (and any later `slice get`), which registers them here automatically.
const components = {
  "AppShell": "AppComponents",
  "HomeSection": "AppComponents",
  "AboutSection": "AppComponents"
}; export default components;
