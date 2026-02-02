// ============================================
// 1. MODIFICAR: /Slice/Slice.js
// ============================================

import Controller from './Components/Structural/Controller/Controller.js';
import StylesManager from './Components/Structural/StylesManager/StylesManager.js';
import EventManager from './Components/Structural/EventManager/EventManager.js';
import ContextManager from './Components/Structural/ContextManager/ContextManager.js'; // 🆕

export default class Slice {
   constructor(sliceConfig) {
      this.controller = new Controller();
      this.stylesManager = new StylesManager();
      this.events = new EventManager();
      this.context = new ContextManager(); // 🆕
      
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
// 2. EJEMPLO COMPLETO: Sistema de Autenticación
// ============================================

// --- Inicializar contextos (en index.js o componente raíz) ---

slice.context.create('auth', {
   isLoggedIn: false,
   user: null,
   token: null
}, { persist: true }); // Se guarda en localStorage

slice.context.create('cart', {
   items: [],
   total: 0
});

slice.context.create('ui', {
   sidebarOpen: false,
   theme: 'light',
   loading: false
});


// --- Componente LoginForm ---
class LoginForm extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$form = this.querySelector('form');
      this.$email = this.querySelector('#email');
      this.$password = this.querySelector('#password');
      this.$error = this.querySelector('.error');
      
      this.$form.addEventListener('submit', (e) => this.handleSubmit(e));
   }

   async handleSubmit(e) {
      e.preventDefault();
      
      try {
         const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               email: this.$email.value,
               password: this.$password.value
            })
         });
         
         const data = await response.json();
         
         // ✅ Actualizar contexto
         slice.context.setState('auth', {
            isLoggedIn: true,
            user: data.user,
            token: data.token
         });
         
         // Navegar al dashboard
         slice.router.navigate('/dashboard');
         
      } catch (error) {
         this.$error.textContent = 'Error al iniciar sesión';
      }
   }
}


// --- Componente Navbar ---
class Navbar extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$userSection = this.querySelector('.user-section');
      this.$loginBtn = this.querySelector('.login-btn');
      this.$userName = this.querySelector('.user-name');
      this.$avatar = this.querySelector('.avatar');
      this.$cartBadge = this.querySelector('.cart-badge');
      
      // ✅ Watch con selector: solo el campo isLoggedIn
      slice.context.watch('auth', this, (isLoggedIn) => {
         this.toggleAuthUI(isLoggedIn);
      }, state => state.isLoggedIn);
      
      // ✅ Watch con selector: objeto con múltiples campos
      slice.context.watch('auth', this, (userData) => {
         if (userData.name) {
            this.$userName.textContent = userData.name;
            this.$avatar.src = userData.avatar || '/default-avatar.png';
         }
      }, state => ({
         name: state.user?.name,
         avatar: state.user?.avatar
      }));
      
      // ✅ Watch con selector: valor computado
      slice.context.watch('cart', this, (itemCount) => {
         this.$cartBadge.textContent = itemCount;
         this.$cartBadge.hidden = itemCount === 0;
      }, state => state.items.length);
      
      // Render inicial
      const auth = slice.context.getState('auth');
      this.toggleAuthUI(auth.isLoggedIn);
   }

   toggleAuthUI(isLoggedIn) {
      this.$loginBtn.hidden = isLoggedIn;
      this.$userSection.hidden = !isLoggedIn;
   }

   handleLogout() {
      slice.context.setState('auth', {
         isLoggedIn: false,
         user: null,
         token: null
      });
      slice.router.navigate('/');
   }
}


// --- Componente CartWidget ---
class CartWidget extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$items = this.querySelector('.cart-items');
      this.$total = this.querySelector('.cart-total');
      this.$count = this.querySelector('.cart-count');
      
      // ✅ Watch completo (sin selector)
      slice.context.watch('cart', this, (state) => {
         this.renderCart(state);
      });
      
      // Render inicial
      const cart = slice.context.getState('cart');
      this.renderCart(cart);
   }

   renderCart(state) {
      this.$count.textContent = `(${state.items.length})`;
      this.$total.textContent = `$${state.total.toFixed(2)}`;
      
      this.$items.innerHTML = state.items.map(item => `
         <div class="cart-item" data-id="${item.id}">
            <span>${item.name}</span>
            <span>$${item.price}</span>
            <button class="remove-btn">×</button>
         </div>
      `).join('');
      
      // Event listeners para remover
      this.$items.querySelectorAll('.remove-btn').forEach(btn => {
         btn.onclick = () => {
            const id = btn.closest('.cart-item').dataset.id;
            this.removeItem(parseInt(id));
         };
      });
   }

   addItem(product) {
      // ✅ setState con función
      slice.context.setState('cart', (prev) => ({
         ...prev,
         items: [...prev.items, product],
         total: prev.total + product.price
      }));
   }

   removeItem(productId) {
      slice.context.setState('cart', (prev) => {
         const item = prev.items.find(i => i.id === productId);
         return {
            ...prev,
            items: prev.items.filter(i => i.id !== productId),
            total: prev.total - (item?.price || 0)
         };
      });
   }

   clearCart() {
      // ✅ setState con objeto directo
      slice.context.setState('cart', {
         items: [],
         total: 0
      });
   }
}


// --- Componente ProductCard ---
class ProductCard extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$addBtn = this.querySelector('.add-to-cart');
      
      this.$addBtn.onclick = () => {
         // Agregar al carrito usando contexto
         slice.context.setState('cart', (prev) => ({
            ...prev,
            items: [...prev.items, {
               id: this.productId,
               name: this.productName,
               price: this.productPrice
            }],
            total: prev.total + this.productPrice
         }));
         
         // También emitir evento si alguien más quiere saber
         slice.events.emit('product:addedToCart', {
            id: this.productId,
            name: this.productName
         });
      };
   }
}


// --- Componente ThemeToggle ---
class ThemeToggle extends HTMLElement {
   async init() {
      this.$toggle = this.querySelector('.toggle');
      
      // Watch del tema
      slice.context.watch('ui', this, (theme) => {
         this.$toggle.checked = theme === 'dark';
         document.body.classList.toggle('dark-theme', theme === 'dark');
      }, state => state.theme);
      
      this.$toggle.onchange = () => {
         slice.context.setState('ui', (prev) => ({
            ...prev,
            theme: prev.theme === 'light' ? 'dark' : 'light'
         }));
      };
   }
}


// ============================================
// 3. COMBINANDO EVENTOS + CONTEXTOS
// ============================================

class NotificationCenter extends HTMLElement {
   async init() {
      this.$container = this.querySelector('.notifications');
      
      // Usar EVENTOS para notificaciones temporales
      this.events = slice.events.bind(this);
      
      this.events.subscribe('notification:show', (notification) => {
         this.showNotification(notification);
      });
      
      // Usar CONTEXTO para el contador de no leídas (persistente)
      slice.context.watch('notifications', this, (count) => {
         this.$badge.textContent = count;
      }, state => state.unreadCount);
   }
   
   showNotification({ type, message, duration = 3000 }) {
      const el = document.createElement('div');
      el.className = `notification ${type}`;
      el.textContent = message;
      this.$container.appendChild(el);
      
      setTimeout(() => el.remove(), duration);
   }
}

// Desde cualquier parte de la app:
slice.events.emit('notification:show', {
   type: 'success',
   message: '¡Producto agregado al carrito!'
});