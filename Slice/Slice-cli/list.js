import fs from 'fs';

//read the Components folder and create a JSON with two arrays: Visual and Structural. Each array contains the name of the components in the folders visual and structural respectively
const visualComponents = fs.readdirSync('./Components/Visual');
const structuralComponents = fs.readdirSync('./Components/Structural');
const services = fs.readdirSync('./Components/Services');
const providers = fs.readdirSync('./Components/Providers');

const componentMap = new Map();

visualComponents.forEach(component => {
  componentMap.set(component, "Visual");
});

services.forEach(component => {
  componentMap.set(component, "Service");
});

providers.forEach(component => {
  componentMap.set(component, "Provider");
});

structuralComponents.forEach(component => {
  componentMap.set(component, "Structural");
});


const mapAsArray = Array.from(componentMap.entries());
const mapObject = Object.fromEntries(mapAsArray);

fs.writeFileSync('./Components/components.js', `const components = ${JSON.stringify(mapObject, null, 2)}; export default components;`);
