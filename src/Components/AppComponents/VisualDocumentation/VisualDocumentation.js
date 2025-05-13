export default class VisualDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // Create code example for visual component
      const buildExample = await slice.build("CodeVisualizer", {
         value: `// Example: Building a visual component
const myButton = await slice.build("Button", {
   value: "Click me!",
   onClickCallback: () => {
      console.log("Button clicked");
   }
});

// Add to the DOM
document.getElementById("container").appendChild(myButton);`,
         language: "javascript"
      });
      
      this.querySelector(".visual-build-example").appendChild(buildExample);

      // Create lifecycle example
      const lifecycleExample = await slice.build("CodeVisualizer", {
         value: `export default class CustomVisualComponent extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      
      // Get references to DOM elements
      this.$button = this.querySelector(".my-button");
      
      // Set up event listeners
      this.$button.addEventListener("click", this.handleClick.bind(this));
      
      // Register properties with controller
      slice.controller.setComponentProps(this, props);
      this.debuggerProps = ["value", "color", "disabled"];
   }

   // Lifecycle method - runs once after construction
   async init() {
      // Initialize default values
      if (!this.value) this.value = "Default Text";
      if (!this.disabled) this.disabled = false;
      
      // Additional async initialization logic
      await this.loadExternalData();
   }
   
   // Lifecycle method - runs every time the component is rendered
   async update() {
      // Update component state based on current data
      this.updateUI();
      
      // Refresh data or perform other operations needed on re-render
      await this.refreshData();
   }
   
   // Custom methods
   handleClick() {
      if (this.onClickCallback) this.onClickCallback();
   }
   
   // Getters and setters for properties
   get value() {
      return this._value;
   }
   
   set value(newValue) {
      this._value = newValue;
      this.$button.textContent = newValue;
   }
}

customElements.define("my-visual-component", CustomVisualComponent);`,
         language: "javascript"
      });
      
      this.querySelector(".visual-lifecycle-example").appendChild(lifecycleExample);

      // Create nested components example
      const nestedComponentsExample = await slice.build("CodeVisualizer", {
         value: `// Parent component: Form.js
export default class Form extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$formContainer = this.querySelector(".form-container");
      
      slice.controller.setComponentProps(this, props);
      this.debuggerProps = ["title", "fields"];
   }

   async init() {
      // Create form title
      const formTitle = document.createElement("h2");
      formTitle.textContent = this.title || "Form";
      this.$formContainer.appendChild(formTitle);
      
      // Create child components (inputs)
      for (const field of this.fields || []) {
         const input = await slice.build("Input", {
            placeholder: field.label,
            type: field.type,
            required: field.required
         });
         
         this.$formContainer.appendChild(input);
      }
      
      // Create submit button
      const submitButton = await slice.build("Button", {
         value: "Submit",
         onClickCallback: () => this.handleSubmit()
      });
      
      this.$formContainer.appendChild(submitButton);
   }
   
   handleSubmit() {
      // Form submission logic
      console.log("Form submitted");
   }
}

customElements.define("slice-form", Form);`,
         language: "javascript"
      });
      
      this.querySelector(".nested-components-example").appendChild(nestedComponentsExample);

      // Usage example for nested components
      const nestedComponentsUsageExample = await slice.build("CodeVisualizer", {
         value: `// Using the Form component with nested components
const myForm = await slice.build("Form", {
   title: "Contact Form",
   fields: [
      { label: "Your Name", type: "text", required: true },
      { label: "Email Address", type: "email", required: true },
      { label: "Message", type: "text", required: false }
   ]
});

document.getElementById("form-container").appendChild(myForm);`,
         language: "javascript"
      });
      
      this.querySelector(".nested-components-usage").appendChild(nestedComponentsUsageExample);

      // Create details components for FAQs
      const questions = [
         {
            title: "How do I pass data between components?",
            text: "You can pass data between components in several ways: 1) Through props when building a component, 2) Using custom events with addEventListener and dispatchEvent, 3) Through a shared service component, or 4) Using the slice.controller to access other components directly via getComponent()."
         },
         {
            title: "Can I create dynamic components at runtime?",
            text: "Yes, you can dynamically create components at runtime using slice.build() and then append them to the DOM. This is useful for creating components based on user interactions or data received from an API."
         },
         {
            title: "How do I handle component cleanup?",
            text: "To properly clean up a component, you should remove all event listeners and cancel any pending operations when the component is no longer needed. You can create a custom destroy() method in your component class that handles cleanup tasks."
         },
         {
            title: "Can I extend existing visual components?",
            text: "Yes, you can extend existing components by creating a new class that inherits from the component you want to extend. This allows you to add new functionality while keeping the original behavior."
         },
         {
            title: "How do I handle component loading states?",
            text: "For components that need to load data asynchronously, you can use the built-in Loading component in Slice.js. Use slice.loading.start() to show the loading indicator and slice.loading.stop() to hide it when your data is ready."
         }
      ];

      const faqContainer = this.querySelector(".faq-section");
      
      for (const question of questions) {
         const detailsComponent = await slice.build("Details", {
            title: question.title,
            text: question.text
         });
         
         faqContainer.appendChild(detailsComponent);
      }
   }
}

customElements.define("slice-visualdocumentation", VisualDocumentation);