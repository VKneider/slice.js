export default class ServiceDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // Create simple service example
      const serviceExample = await slice.build('CodeVisualizer', {
         value: `// Example: Basic Service Component
export default class DataService {
   constructor(props = {}) {
      // Initialize state and config
      this.baseUrl = props.baseUrl || 'https://api.example.com';
      this.cache = new Map();
      
      // Register with controller if needed
      if (props.sliceId) {
         slice.controller.registerComponent(this);
      }
   }

   async fetchData(endpoint) {
      // Check cache first
      if (this.cache.has(endpoint)) {
         return this.cache.get(endpoint);
      }
      
      // Show loading indicator
      slice.loading.start();
      
      try {
         // Fetch data from API
         const response = await fetch(\`\${this.baseUrl}/\${endpoint}\`);
         const data = await response.json();
         
         // Cache the response
         this.cache.set(endpoint, data);
         return data;
      } catch (error) {
         // Log error
         slice.logger.logError('DataService', \`Error fetching \${endpoint}\`, error);
         throw error;
      } finally {
         // Hide loading indicator
         slice.loading.stop();
      }
   }
   
   clearCache() {
      this.cache.clear();
   }
}`,
         language: 'javascript'
      });
      
      this.querySelector('.service-example').appendChild(serviceExample);

      // Create service usage example
      const serviceUsageExample = await slice.build('CodeVisualizer', {
         value: `// Building and using a service component
const dataService = await slice.build('DataService', {
   baseUrl: 'https://api.myapp.com/v1',
   sliceId: 'data-service'
});

// Using the service in a visual component
export default class ProductList extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$productList = this.querySelector('.product-list');
      
      slice.controller.setComponentProps(this, props);
   }
   
   async init() {
      // Get a reference to our service
      this.dataService = slice.controller.getComponent('data-service');
      
      // Load initial data
      await this.loadProducts();
   }
   
   async loadProducts() {
      try {
         // Use the service to fetch data
         const products = await this.dataService.fetchData('products');
         
         // Render the products
         this.renderProducts(products);
      } catch (error) {
         // Handle error
         this.showError("Failed to load products");
      }
   }
   
   renderProducts(products) {
      // Clear existing content
      this.$productList.innerHTML = '';
      
      // Create product items
      products.forEach(async product => {
         const productItem = await slice.build('ProductItem', { product });
         this.$productList.appendChild(productItem);
      });
   }
}`,
         language: 'javascript'
      });
      
      this.querySelector('.service-usage-example').appendChild(serviceUsageExample);

      // Create FetchManager example
      const fetchManagerExample = await slice.build('CodeVisualizer', {
         value: `// Using the built-in FetchManager service
const fetchManager = await slice.build('FetchManager', {
   baseUrl: 'https://api.example.com',
   timeout: 5000,
   sliceId: 'api-manager'
});

// Making API requests with FetchManager
const userData = await fetchManager.request(
   'GET',                       // HTTP Method
   null,                        // Request body (for POST/PUT)
   'users/profile',             // Endpoint
   (data, response) => {        // onRequestSuccess callback
      console.log('Success!', data);
   },
   (data, response) => {        // onRequestError callback
      console.error('Error:', response.status);
   },
   true,                        // refetchOnError
   {                            // requestOptions
      headers: {
         'Authorization': 'Bearer token123'
      }
   }
);

// Enabling caching
fetchManager.enableCache();

// Setting default headers for all requests
fetchManager.setDefaultHeaders({
   'Content-Type': 'application/json',
   'X-API-Key': 'your-api-key'
});`,
         language: 'javascript'
      });
      
      this.querySelector('.fetch-manager-example').appendChild(fetchManagerExample);

      // Create LocalStorageManager example
      const localStorageExample = await slice.build('CodeVisualizer', {
         value: `// Using the LocalStorageManager service
const storageManager = await slice.build('LocalStorageManager', {
   sliceId: 'storage-manager'
});

// Storing data
storageManager.setItem('user-preferences', {
   theme: 'dark',
   language: 'en',
   notifications: true
});

// Retrieving data
const preferences = storageManager.getItem('user-preferences');
console.log(preferences.theme); // 'dark'

// Removing data
storageManager.removeItem('temporary-data');

// Clearing all data
storageManager.clear();`,
         language: 'javascript'
      });
      
      this.querySelector('.local-storage-example').appendChild(localStorageExample);

      // Create IndexedDbManager example
      const indexedDbExample = await slice.build('CodeVisualizer', {
         value: `// Using the IndexedDbManager service
const dbManager = await slice.build('IndexedDbManager', {
   databaseName: 'app-database',
   storeName: 'tasks',
   sliceId: 'db-manager'
});

// Opening the database
await dbManager.openDatabase();

// Adding an item
const newTask = {
   title: 'Complete documentation',
   priority: 'high',
   completed: false,
   dueDate: new Date()
};
const taskId = await dbManager.addItem(newTask);

// Getting an item
const task = await dbManager.getItem(taskId);

// Updating an item
task.completed = true;
await dbManager.updateItem(task);

// Getting all items
const allTasks = await dbManager.getAllItems();

// Deleting an item
await dbManager.deleteItem(taskId);

// Close the database when done
dbManager.closeDatabase();`,
         language: 'javascript'
      });
      
      this.querySelector('.indexed-db-example').appendChild(indexedDbExample);

      // Create translator example
      const translatorExample = await slice.build('CodeVisualizer', {
         value: `// Configuring the Translator service in sliceConfig.json
{
   "translator": {
      "enabled": true
   }
}

// messages.json structure
{
   "en": {
      "button": {
         "value": "Submit"
      },
      "header": {
         "title": "Welcome to our application"
      }
   },
   "es": {
      "button": {
         "value": "Enviar"
      },
      "header": {
         "title": "Bienvenido a nuestra aplicación"
      }
   }
}

// Using translation in components
export default class Header extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$title = this.querySelector('.title');
      
      slice.controller.setComponentProps(this, props);
   }
   
   init() {
      // Properties will be automatically translated
      // based on the current language
   }
}

// Changing the language
slice.translator.changeLanguage('es');`,
         language: 'javascript'
      });
      
      this.querySelector('.translator-example').appendChild(translatorExample);

      // Create custom service example
      const customServiceExample = await slice.build('CodeVisualizer', {
         value: `// Creating a custom service component
export default class AuthService {
   constructor(props = {}) {
      this.apiUrl = props.apiUrl || '/api/auth';
      this.tokenKey = 'auth_token';
      this.user = null;
      
      // Register with controller
      if (props.sliceId) {
         slice.controller.registerComponent(this);
      }
      
      // Create storage manager for token persistence
      this.storageManager = new (slice.controller.classes.get('LocalStorageManager'))();
      
      // Initialize fetch manager for API calls
      this.fetchManager = new (slice.controller.classes.get('FetchManager'))({
         baseUrl: this.apiUrl
      });
   }
   
   async init() {
      // Check for existing token on initialization
      const token = this.storageManager.getItem(this.tokenKey);
      if (token) {
         try {
            // Validate the token and get user info
            await this.validateToken(token);
         } catch (error) {
            // Clear invalid token
            this.logout();
         }
      }
   }
   
   async login(username, password) {
      try {
         const response = await this.fetchManager.request(
            'POST',
            { username, password },
            'login'
         );
         
         if (response && response.token) {
            this.storageManager.setItem(this.tokenKey, response.token);
            this.user = response.user;
            return this.user;
         }
      } catch (error) {
         slice.logger.logError('AuthService', 'Login failed', error);
         throw error;
      }
   }
   
   async validateToken(token) {
      try {
         const response = await this.fetchManager.request(
            'GET',
            null,
            'validate',
            null,
            null,
            false,
            {
               headers: {
                  'Authorization': \`Bearer \${token}\`
               }
            }
         );
         
         if (response && response.valid) {
            this.user = response.user;
            return true;
         }
         return false;
      } catch (error) {
         return false;
      }
   }
   
   isAuthenticated() {
      return !!this.user;
   }
   
   logout() {
      this.user = null;
      this.storageManager.removeItem(this.tokenKey);
   }
   
   getUser() {
      return this.user;
   }
}`,
         language: 'javascript'
      });
      
      this.querySelector('.custom-service-example').appendChild(customServiceExample);

      // Create FAQ section
      const faqQuestions = [
         {
            title: "How do services differ from visual components?",
            text: "Service components focus on business logic and data management without any visual representation. They don't extend HTMLElement or use templates. Instead, they provide methods and properties that other components can use to perform operations like API calls, data storage, or other application services."
         },
         {
            title: "Should I register service components with the controller?",
            text: "Yes, registering service components with the controller allows them to be accessed globally via slice.controller.getComponent(). This makes it easy to share a single instance of a service across multiple components, following the singleton pattern for services like API clients or authentication managers."
         },
         {
            title: "How can I handle authentication in Slice.js?",
            text: "Create a dedicated AuthService component that handles login, logout, token management, and user information. Store authentication tokens using LocalStorageManager or IndexedDbManager, and add methods to check if the user is authenticated. Other components can then use this service to secure routes or display user-specific content."
         },
         {
            title: "Can services communicate with each other?",
            text: "Yes, services can communicate with each other by accessing other service instances through slice.controller.getComponent() or by dependency injection in the constructor. For example, an AuthService might use a FetchManager for API calls and a LocalStorageManager for token persistence."
         },
         {
            title: "How do I handle offline functionality?",
            text: "Implement a SyncService that works with IndexedDbManager to store data locally when offline. This service should track changes made offline and synchronize them when the connection is restored. You can use the FetchManager with a custom queue system to manage pending requests."
         }
      ];

      const faqContainer = this.querySelector('.faq-section');
      
      for (const question of faqQuestions) {
         const detailsComponent = await slice.build('Details', {
            title: question.title,
            text: question.text
         });
         
         faqContainer.appendChild(detailsComponent);
      }
   }
}

customElements.define('slice-servicedocumentation', ServiceDocumentation);