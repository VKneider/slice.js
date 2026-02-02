// ============================================
// 1. MODIFICAR: /Slice/Slice.js
// ============================================

import Controller from './Components/Structural/Controller/Controller.js';
import StylesManager from './Components/Structural/StylesManager/StylesManager.js';
import EventManager from './Components/Structural/EventManager/EventManager.js'; // 🆕 AGREGAR

export default class Slice {
   constructor(sliceConfig) {
      this.controller = new Controller();
      this.stylesManager = new StylesManager();
      this.events = new EventManager(); // 🆕 AGREGAR
      
      this.paths = sliceConfig.paths;
      this.themeConfig = sliceConfig.themeManager;
      this.stylesConfig = sliceConfig.stylesManager;
      this.loggerConfig = sliceConfig.logger;
      this.debuggerConfig = sliceConfig.debugger;
      this.loadingConfig = sliceConfig.loading;
   }
   
   // ... resto igual
}


// ============================================
// 2. MODIFICAR: /Slice/Components/Structural/Controller/Controller.js
// En el método destroyComponent, agregar limpieza de eventos
// ============================================

// Buscar este bloque en destroyComponent():
if (typeof component.beforeDestroy === 'function') {
   try {
      component.beforeDestroy();
   } catch (error) {
      slice.logger.logError('Controller', `Error in beforeDestroy for ${sliceId}`, error);
   }
}

// 🆕 AGREGAR justo después:
// Limpiar suscripciones de eventos del componente
if (slice.events) {
   slice.events.cleanupComponent(sliceId);
}


// ============================================
// 3. EJEMPLO DE USO EN COMPONENTES
// ============================================

// --- Componente que EMITE eventos ---
class LoginForm extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$form = this.querySelector('form');
      this.$form.addEventListener('submit', (e) => this.handleSubmit(e));
   }

   async handleSubmit(e) {
      e.preventDefault();
      
      const email = this.querySelector('#email').value;
      const password = this.querySelector('#password').value;
      
      try {
         const response = await fetch('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
         });
         const user = await response.json();
         
         // ✅ Emitir evento global
         slice.events.emit('user:login', user);
         
      } catch (error) {
         slice.events.emit('user:loginError', { message: error.message });
      }
   }
}


// --- Componente que ESCUCHA eventos ---
class Navbar extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$userSection = this.querySelector('.user-section');
      this.$loginBtn = this.querySelector('.login-btn');
      
      // ✅ Vincular eventos a este componente
      this.events = slice.events.bind(this);
      
      // ✅ Suscribirse (se limpia automáticamente)
      this.events.subscribe('user:login', (user) => {
         this.showUserInfo(user);
      });
      
      this.events.subscribe('user:logout', () => {
         this.showLoginButton();
      });
   }

   showUserInfo(user) {
      this.$loginBtn.style.display = 'none';
      this.$userSection.innerHTML = `
         <img src="${user.avatar}" alt="${user.name}">
         <span>${user.name}</span>
      `;
   }

   showLoginButton() {
      this.$loginBtn.style.display = 'block';
      this.$userSection.innerHTML = '';
   }
}


// --- Componente que escucha UNA SOLA VEZ ---
class AppLoader extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$spinner = this.querySelector('.spinner');
      
      this.events = slice.events.bind(this);
      
      // ✅ Solo la primera vez
      this.events.subscribeOnce('app:dataLoaded', () => {
         this.hideSpinner();
      });
   }

   hideSpinner() {
      this.$spinner.classList.add('hidden');
   }
}


// --- Uso SIN bind (manual) ---
class Analytics extends HTMLElement {
   async init() {
      // Guardar ID para limpiar después
      this.loginSubId = slice.events.subscribe('user:login', (user) => {
         this.trackLogin(user);
      });
      
      this.logoutSubId = slice.events.subscribe('user:logout', () => {
         this.trackLogout();
      });
   }

   // ⚠️ Debes limpiar manualmente
   beforeDestroy() {
      slice.events.unsubscribe('user:login', this.loginSubId);
      slice.events.unsubscribe('user:logout', this.logoutSubId);
   }
}


// ============================================
// 4. PATRONES COMUNES
// ============================================

// Patrón: Comunicación padre-hijo
class ProductList extends HTMLElement {
   async init() {
      this.events = slice.events.bind(this);
      
      // Escuchar cuando un producto hijo pide ser eliminado
      this.events.subscribe('product:remove', (productId) => {
         this.removeProduct(productId);
      });
   }
}

class ProductCard extends HTMLElement {
   async init() {
      this.events = slice.events.bind(this);
      
      this.querySelector('.delete-btn').onclick = () => {
         // Avisar al padre
         this.events.emit('product:remove', this.productId);
      };
   }
}


// Patrón: Notificaciones globales
class NotificationCenter extends HTMLElement {
   async init() {
      this.events = slice.events.bind(this);
      
      this.events.subscribe('notification:show', (notification) => {
         this.showNotification(notification);
      });
   }
}

// Desde cualquier parte de la app:
slice.events.emit('notification:show', {
   type: 'success',
   message: 'Guardado correctamente!'
});


// Patrón: Loading global
class LoadingOverlay extends HTMLElement {
   async init() {
      this.events = slice.events.bind(this);
      
      this.events.subscribe('loading:start', () => this.show());
      this.events.subscribe('loading:stop', () => this.hide());
   }
}

// Desde un servicio:
async function fetchData() {
   slice.events.emit('loading:start');
   const data = await fetch('/api/data');
   slice.events.emit('loading:stop');
   return data;
}