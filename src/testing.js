   /**
    * 🧪 Sistema de Testing para Slice.js
    * 
    * Este archivo contiene métodos para testear la implementación del RouteRenderer
    * y verificar que el sistema de gestión de componentes funciona correctamente.
    */

   // Rutas reales de la aplicación para testing
   const REAL_ROUTES = [
      '/',
      '/Playground',
      '/Documentation',
      '/Documentation/Slice',
      '/Documentation/Commands',
      '/Documentation/SliceConfig',
      '/Documentation/Visual',
      '/Documentation/Service',
      '/Documentation/Structural',
      '/Documentation/Themes',
      '/Documentation/Routing',
      '/Documentation/Installation',
      '/Documentation/The-build-method',
      '/Documentation/Components/Visual',
      '/Documentation/Components/Visual/Card',
      '/Documentation/Components/Visual/Button',
      '/Documentation/Components/Visual/Switch',
      '/Documentation/Components/Visual/Checkbox',
      '/Documentation/Components/Visual/Input',
      '/About',
      '/404'
   ];

   // Función para ejecutar tests desde la consola del navegador
   window.testSliceImplementation = async function() {
      console.log('🚀 Iniciando tests de Slice.js...\n');
      
      if (!window.slice || !window.slice.router) {
         console.error('❌ Slice.js no está inicializado. Asegúrate de que la aplicación esté cargada.');
         return;
      }

      const renderer = window.slice.router.routeRenderer;
      
      try {
         // Ejecutar todos los tests
         const results = await renderer.runAllTests();
         
         // Ejecutar test de rendimiento con rutas reales
         console.log('\n' + '='.repeat(50));
         const performanceResults = await renderer.testPerformanceWithRealRoutes();
         
         // Mostrar estadísticas finales
         console.log('\n' + '='.repeat(50));
         console.log('📈 ESTADÍSTICAS FINALES:');
         const finalStats = renderer.getStats();
         console.log(`   Total componentes activos: ${finalStats.controllerStats.totalActiveComponents}`);
         console.log(`   Componentes huérfanos: ${finalStats.controllerStats.orphanedComponents}`);
         console.log(`   Componentes en pool: ${finalStats.totalPooledComponents}`);
         
         return {
            testResults: results,
            performanceResults,
            finalStats
         };
      } catch (error) {
         console.error('❌ Error durante los tests:', error);
         return { error: error.message };
      }
   };

   // Función para monitorear componentes en tiempo real
   window.monitorComponents = function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      const renderer = window.slice.router.routeRenderer;
      const stats = renderer.getStats();
      
      console.log('📊 MONITOREO DE COMPONENTES:');
      console.log(`   Total activos: ${stats.controllerStats.totalActiveComponents}`);
      console.log(`   Huérfanos: ${stats.controllerStats.orphanedComponents}`);
      console.log(`   En pool: ${stats.totalPooledComponents}`);
      
      if (stats.controllerStats.orphanedComponents > 0) {
         console.log('   🧹 Componentes huérfanos encontrados:');
         stats.controllerStats.orphanedComponentIds.forEach(id => {
            console.log(`      - ${id}`);
         });
      }
      
      console.log('\n   📋 Por tipo:');
      Object.entries(stats.controllerStats.activeComponentsByType).forEach(([type, counts]) => {
         console.log(`      ${type}: ${counts.total} (${counts.connected} conectados, ${counts.orphaned} huérfanos)`);
      });
   };

   // Función para limpiar componentes huérfanos manualmente
   window.cleanupOrphanedComponents = function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      const renderer = window.slice.router.routeRenderer;
      const cleanedCount = renderer.cleanupOrphanedComponents();
      
      console.log(`🧹 Limpiados ${cleanedCount} componentes huérfanos.`);
      return cleanedCount;
   };

   // Función para simular navegación y testear reutilización con rutas reales
   window.testNavigation = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      console.log('🧭 Test de navegación con rutas reales...');
      
      const initialCount = window.slice.controller.activeComponents.size;
      console.log(`   Componentes iniciales: ${initialCount}`);
      
      // Simular navegaciones con rutas reales
      const testRoutes = ['/', '/Playground', '/Documentation', '/About', '/', '/Documentation/Slice'];
      
      for (let i = 0; i < testRoutes.length; i++) {
         const route = testRoutes[i];
         console.log(`   Navegando a: ${route}`);
         
         const beforeCount = window.slice.controller.activeComponents.size;
         window.slice.router.navigate(route);
         
         // Esperar un poco para que se complete la navegación
         await new Promise(resolve => setTimeout(resolve, 150));
         
         const afterCount = window.slice.controller.activeComponents.size;
         const created = afterCount - beforeCount;
         
         if (created > 0) {
            console.log(`     ➕ Creados: ${created} componentes`);
         } else {
            console.log(`     🔄 Reutilizados componentes existentes`);
         }
      }
      
      const finalCount = window.slice.controller.activeComponents.size;
      const totalCreated = finalCount - initialCount;
      
      console.log(`\n📊 Resultado:`);
      console.log(`   Componentes iniciales: ${initialCount}`);
      console.log(`   Componentes finales: ${finalCount}`);
      console.log(`   Total creados: ${totalCreated}`);
      console.log(`   Eficiencia: ${(((testRoutes.length - totalCreated) / testRoutes.length) * 100).toFixed(1)}%`);
      
      return {
         initialCount,
         finalCount,
         totalCreated,
         efficiency: ((testRoutes.length - totalCreated) / testRoutes.length) * 100
      };
   };

   // Función para testear navegación en rutas anidadas
   window.testNestedRoutes = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      console.log('🌳 Test de rutas anidadas...');
      
      const initialCount = window.slice.controller.activeComponents.size;
      console.log(`   Componentes iniciales: ${initialCount}`);
      
      // Test de navegación en rutas anidadas
      const nestedRoutes = [
         '/Documentation',
         '/Documentation/Slice',
         '/Documentation/Commands',
         '/Documentation/Components/Visual',
         '/Documentation/Components/Visual/Card',
         '/Documentation/Components/Visual/Button',
         '/Documentation/Components/Visual/Switch',
         '/Documentation/Components/Visual/Checkbox',
         '/Documentation/Components/Visual/Input'
      ];
      
      let totalCreated = 0;
      
      for (let i = 0; i < nestedRoutes.length; i++) {
         const route = nestedRoutes[i];
         console.log(`   Navegando a: ${route}`);
         
         const beforeCount = window.slice.controller.activeComponents.size;
         window.slice.router.navigate(route);
         
         // Esperar un poco más para rutas complejas
         await new Promise(resolve => setTimeout(resolve, 200));
         
         const afterCount = window.slice.controller.activeComponents.size;
         const created = afterCount - beforeCount;
         totalCreated += created;
         
         if (created > 0) {
            console.log(`     ➕ Creados: ${created} componentes`);
         } else {
            console.log(`     🔄 Reutilizados componentes existentes`);
         }
      }
      
      const finalCount = window.slice.controller.activeComponents.size;
      const actualCreated = finalCount - initialCount;
      
      console.log(`\n📊 Resultado de rutas anidadas:`);
      console.log(`   Componentes iniciales: ${initialCount}`);
      console.log(`   Componentes finales: ${finalCount}`);
      console.log(`   Total creados: ${actualCreated}`);
      console.log(`   Eficiencia: ${(((nestedRoutes.length - actualCreated) / nestedRoutes.length) * 100).toFixed(1)}%`);
      
      return {
         initialCount,
         finalCount,
         totalCreated: actualCreated,
         efficiency: ((nestedRoutes.length - actualCreated) / nestedRoutes.length) * 100
      };
   };

   // Función para testear stress con rutas reales
   window.stressTest = async function(iterations = 10) {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      console.log(`💪 Test de stress con rutas reales (${iterations} iteraciones)...`);
      
      const startTime = performance.now();
      const initialCount = window.slice.controller.activeComponents.size;
      
      // Usar rutas reales para el stress test
      const routes = ['/', '/Playground', '/Documentation', '/About'];
      
      for (let i = 0; i < iterations; i++) {
         const route = routes[i % routes.length];
         window.slice.router.navigate(route);
         await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const endTime = performance.now();
      const finalCount = window.slice.controller.activeComponents.size;
      const timeElapsed = endTime - startTime;
      const componentsCreated = finalCount - initialCount;
      
      console.log(`\n📊 Resultados del stress test:`);
      console.log(`   ⏱️  Tiempo total: ${timeElapsed.toFixed(2)}ms`);
      console.log(`   📦 Componentes creados: ${componentsCreated}`);
      console.log(`   🔄 Componentes reutilizados: ${iterations - componentsCreated}`);
      console.log(`   📈 Eficiencia: ${(((iterations - componentsCreated) / iterations) * 100).toFixed(1)}%`);
      console.log(`   ⚡ Velocidad: ${(iterations / (timeElapsed / 1000)).toFixed(1)} navegaciones/segundo`);
      
      return {
         timeElapsed,
         componentsCreated,
         componentsReused: iterations - componentsCreated,
         efficiency: ((iterations - componentsCreated) / iterations) * 100,
         speed: iterations / (timeElapsed / 1000)
      };
   };

   // Función para testear rutas específicas
   window.testSpecificRoutes = async function(routes = null) {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      const routesToTest = routes || [
         '/Documentation/Slice',
         '/Documentation/Commands',
         '/Documentation/Components/Visual/Card',
         '/Documentation/Components/Visual/Button'
      ];

      console.log(`🎯 Test de rutas específicas: ${routesToTest.join(', ')}`);
      
      const initialCount = window.slice.controller.activeComponents.size;
      const results = [];
      
      for (let i = 0; i < routesToTest.length; i++) {
         const route = routesToTest[i];
         console.log(`   Navegando a: ${route}`);
         
         const beforeCount = window.slice.controller.activeComponents.size;
         const startTime = performance.now();
         
         window.slice.router.navigate(route);
         await new Promise(resolve => setTimeout(resolve, 150));
         
         const endTime = performance.now();
         const afterCount = window.slice.controller.activeComponents.size;
         const created = afterCount - beforeCount;
         const timeElapsed = endTime - startTime;
         
         results.push({
            route,
            created,
            timeElapsed,
            success: created >= 0 // Al menos no debería crear componentes negativos
         });
         
         if (created > 0) {
            console.log(`     ➕ Creados: ${created} componentes (${timeElapsed.toFixed(2)}ms)`);
         } else {
            console.log(`     🔄 Reutilizados (${timeElapsed.toFixed(2)}ms)`);
         }
      }
      
      const finalCount = window.slice.controller.activeComponents.size;
      const totalCreated = finalCount - initialCount;
      const successfulRoutes = results.filter(r => r.success).length;
      
      console.log(`\n📊 Resultado de rutas específicas:`);
      console.log(`   Rutas exitosas: ${successfulRoutes}/${routesToTest.length}`);
      console.log(`   Componentes creados: ${totalCreated}`);
      console.log(`   Tiempo promedio: ${(results.reduce((sum, r) => sum + r.timeElapsed, 0) / results.length).toFixed(2)}ms`);
      
      return {
         results,
         totalCreated,
         successfulRoutes,
         averageTime: results.reduce((sum, r) => sum + r.timeElapsed, 0) / results.length
      };
   };

   // Función para testear todas las rutas disponibles
   window.testAllRoutes = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      console.log(`🌐 Test de todas las rutas disponibles (${REAL_ROUTES.length} rutas)...`);
      
      const initialCount = window.slice.controller.activeComponents.size;
      const results = [];
      let successfulRoutes = 0;
      let totalCreated = 0;
      
      for (let i = 0; i < REAL_ROUTES.length; i++) {
         const route = REAL_ROUTES[i];
         console.log(`   [${i + 1}/${REAL_ROUTES.length}] Navegando a: ${route}`);
         
         const beforeCount = window.slice.controller.activeComponents.size;
         const startTime = performance.now();
         
         try {
            window.slice.router.navigate(route);
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const endTime = performance.now();
            const afterCount = window.slice.controller.activeComponents.size;
            const created = afterCount - beforeCount;
            const timeElapsed = endTime - startTime;
            
            totalCreated += created;
            successfulRoutes++;
            
            results.push({
               route,
               created,
               timeElapsed,
               success: true
            });
            
            if (created > 0) {
               console.log(`     ➕ Creados: ${created} componentes (${timeElapsed.toFixed(2)}ms)`);
            } else {
               console.log(`     🔄 Reutilizados (${timeElapsed.toFixed(2)}ms)`);
            }
         } catch (error) {
            console.log(`     ❌ Error: ${error.message}`);
            results.push({
               route,
               created: 0,
               timeElapsed: 0,
               success: false,
               error: error.message
            });
         }
      }
      
      const finalCount = window.slice.controller.activeComponents.size;
      const actualCreated = finalCount - initialCount;
      
      console.log(`\n📊 Resultado de todas las rutas:`);
      console.log(`   Rutas exitosas: ${successfulRoutes}/${REAL_ROUTES.length}`);
      console.log(`   Componentes creados: ${actualCreated}`);
      console.log(`   Tiempo promedio: ${(results.filter(r => r.success).reduce((sum, r) => sum + r.timeElapsed, 0) / successfulRoutes).toFixed(2)}ms`);
      console.log(`   Eficiencia: ${(((REAL_ROUTES.length - actualCreated) / REAL_ROUTES.length) * 100).toFixed(1)}%`);
      
      return {
         results,
         successfulRoutes,
         totalCreated: actualCreated,
         efficiency: ((REAL_ROUTES.length - actualCreated) / REAL_ROUTES.length) * 100
      };
   };

   // Función para mostrar ayuda
   window.showTestingHelp = function() {
      console.log(`
   🧪 SISTEMA DE TESTING DE SLICE.JS

   Comandos disponibles:

   📋 testSliceImplementation()
      Ejecuta todos los tests automáticamente
      
   🧪 testSimple()
      Test simple de funcionalidad básica
      
   🔍 debugReuse()
      Debug específico de reutilización de componentes
      
   📊 monitorComponents()
      Muestra estadísticas actuales de componentes
      
   🧹 cleanupOrphanedComponents()
      Limpia componentes huérfanos manualmente
      
   🧭 testNavigation()
      Test de navegación con rutas reales básicas
      
   🌳 testNestedRoutes()
      Test de rutas anidadas (Documentation/Components/...)
      
   🎯 testSpecificRoutes([routes])
      Test de rutas específicas personalizadas
      
   🌐 testAllRoutes()
      Test de todas las rutas disponibles
      
   💪 stressTest(iterations)
      Test de stress con múltiples navegaciones
      
   🔍 checkAvailableComponents()
      Verifica qué componentes están disponibles
      
   🏊 debugComponentPool()
      Debug del pool de componentes
      
   🧪 testComponentPoolManually()
      Test manual del pool de componentes
      
   🧪 testWithAvailableComponents()
      Test con componentes disponibles
      
   📊 testWithStateTracking()
      Test con seguimiento de estado antes/después
      
   ❓ showTestingHelp()
      Muestra esta ayuda

   Ejemplo de uso:
      testSimple()                              // Test simple y rápido
      debugReuse()                              // Debug específico de reutilización
      testSliceImplementation()                 // Ejecutar todos los tests
      testWithStateTracking()                   // Test con seguimiento de estado
      debugComponentPool()                      // Debug del pool
      testComponentPoolManually()               // Test manual del pool
      testNestedRoutes()                        // Test rutas anidadas
      testSpecificRoutes(['/Documentation/Slice']) // Test ruta específica
      testAllRoutes()                           // Test todas las rutas
      stressTest(20)                            // Test de stress con 20 iteraciones
   `);
   };

   // Función para verificar componentes disponibles
   window.checkAvailableComponents = function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      const availableComponents = Array.from(window.slice.controller.componentCategories.keys());
      
      console.log('🔍 COMPONENTES DISPONIBLES:');
      console.log(`   Total: ${availableComponents.length} componentes`);
      console.log('\n   📋 Lista completa:');
      availableComponents.forEach((component, index) => {
         console.log(`      ${index + 1}. ${component}`);
      });
      
      // Verificar componentes críticos para los tests
      const criticalComponents = ['Playground', 'Button', 'Input', 'Card'];
      console.log('\n   ✅ Componentes críticos para tests:');
      criticalComponents.forEach(component => {
         if (availableComponents.includes(component)) {
            console.log(`      ✅ ${component} - Disponible`);
         } else {
            console.log(`      ❌ ${component} - No disponible`);
         }
      });
      
      return availableComponents;
   };

   // Función para testear con componentes disponibles
   window.testWithAvailableComponents = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      const availableComponents = Array.from(window.slice.controller.componentCategories.keys());
      
      if (availableComponents.length === 0) {
         console.error('❌ No hay componentes disponibles para testing.');
         return;
      }

      console.log('🧪 Test con componentes disponibles...');
      console.log(`   Componentes disponibles: ${availableComponents.join(', ')}`);
      
      // Usar el primer componente disponible para testing
      const testComponent = availableComponents[0];
      console.log(`   Usando componente: ${testComponent}`);
      
      const initialCount = window.slice.controller.activeComponents.size;
      console.log(`   Componentes iniciales: ${initialCount}`);
      
      // Test de creación y reutilización
      const testRoutes = [
         { path: '/test1', component: testComponent },
         { path: '/test2', component: testComponent },
         { path: '/test1', component: testComponent } // Debería reutilizar
      ];
      
      for (let i = 0; i < testRoutes.length; i++) {
         const route = testRoutes[i];
         console.log(`   Navegando a: ${route.path} (${route.component})`);
         
         const beforeCount = window.slice.controller.activeComponents.size;
         window.slice.router.routeRenderer.handleRoute(route, {});
         
         // Esperar un poco para que se complete
         await new Promise(resolve => setTimeout(resolve, 100));
         
         const afterCount = window.slice.controller.activeComponents.size;
         const created = afterCount - beforeCount;
         
         if (created > 0) {
            console.log(`     ➕ Creados: ${created} componentes`);
         } else {
            console.log(`     🔄 Reutilizados componentes existentes`);
         }
      }
      
      const finalCount = window.slice.controller.activeComponents.size;
      const totalCreated = finalCount - initialCount;
      
      console.log(`\n📊 Resultado:`);
      console.log(`   Componentes iniciales: ${initialCount}`);
      console.log(`   Componentes finales: ${finalCount}`);
      console.log(`   Total creados: ${totalCreated}`);
      console.log(`   Eficiencia: ${(((testRoutes.length - totalCreated) / testRoutes.length) * 100).toFixed(1)}%`);
      
      return {
         testComponent,
         initialCount,
         finalCount,
         totalCreated,
         efficiency: ((testRoutes.length - totalCreated) / testRoutes.length) * 100
      };
   };

   // Función para debuggear el pool de componentes
   window.debugComponentPool = function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      const renderer = window.slice.router.routeRenderer;
      
      console.log('🔍 DEBUG DEL POOL DE COMPONENTES:');
      console.log(`   Tamaño máximo del pool: ${renderer.maxPoolSize}`);
      console.log(`   Pool actual:`);
      
      if (renderer.componentPool.size === 0) {
         console.log('      (vacío)');
      } else {
         for (const [componentName, pool] of renderer.componentPool.entries()) {
            console.log(`      ${componentName}: ${pool.length} componentes`);
            pool.forEach((component, index) => {
               console.log(`        ${index + 1}. sliceId: ${component.sliceId || 'sin sliceId'}, connected: ${component.isConnected}`);
            });
         }
      }
      
      console.log(`\n   Componentes activos en controller: ${window.slice.controller.activeComponents.size}`);
      console.log(`   Componentes activos en renderer: ${renderer.activeComponents.size}`);
      
      return {
         poolSize: renderer.componentPool.size,
         totalPooledComponents: Array.from(renderer.componentPool.values()).reduce((total, pool) => total + pool.length, 0),
         controllerActiveComponents: window.slice.controller.activeComponents.size,
         rendererActiveComponents: renderer.activeComponents.size
      };
   };

   // Función para testear el pool manualmente
   window.testComponentPoolManually = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      const renderer = window.slice.router.routeRenderer;
      
      console.log('🧪 Test manual del pool de componentes...');
      
      // 1. Crear un componente
      const component = await window.slice.build('Button', {
         value: 'Pool Test',
         sliceId: 'manual-pool-test'
      });
      
      console.log(`   1. Componente creado: ${component ? '✅' : '❌'}`);
      console.log(`      sliceId: ${component?.sliceId}`);
      console.log(`      tagName: ${component?.tagName}`);
      console.log(`      constructor: ${component?.constructor?.name}`);
      
      // 2. Añadir al pool
      const beforePoolSize = renderer.componentPool.size;
      renderer.addToPool(component);
      const afterPoolSize = renderer.componentPool.size;
      
      console.log(`   2. Añadido al pool: ${afterPoolSize > beforePoolSize ? '✅' : '❌'}`);
      console.log(`      Pool size: ${beforePoolSize} -> ${afterPoolSize}`);
      
      // 3. Verificar contenido del pool
      debugComponentPool();
      
      // 4. Obtener del pool
      const retrievedComponent = renderer.getFromPool('button');
      console.log(`   3. Obtenido del pool: ${retrievedComponent ? '✅' : '❌'}`);
      console.log(`      Componente recuperado: ${retrievedComponent === component ? '✅ mismo' : '❌ diferente'}`);
      
      return {
         created: !!component,
         addedToPool: afterPoolSize > beforePoolSize,
         retrieved: !!retrievedComponent,
         isSameComponent: retrievedComponent === component
      };
   };

   // Función para ver estado antes y después de tests
   window.testWithStateTracking = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      console.log('📊 Test con seguimiento de estado...');
      
      // Estado inicial
      const initialState = {
         controllerComponents: window.slice.controller.activeComponents.size,
         rendererComponents: window.slice.router.routeRenderer.activeComponents.size,
         poolSize: window.slice.router.routeRenderer.componentPool.size,
         orphanedComponents: 0
      };
      
      // Contar componentes huérfanos
      for (const [sliceId, component] of window.slice.controller.activeComponents.entries()) {
         if (!component.isConnected && component !== window.slice.loading) {
            initialState.orphanedComponents++;
         }
      }
      
      console.log('📈 Estado inicial:');
      console.log(`   Controller: ${initialState.controllerComponents} componentes`);
      console.log(`   Renderer: ${initialState.rendererComponents} componentes`);
      console.log(`   Pool: ${initialState.poolSize} tipos`);
      console.log(`   Huérfanos: ${initialState.orphanedComponents} componentes`);
      
      // Ejecutar tests
      console.log('\n🧪 Ejecutando tests...');
      const results = await window.testSliceImplementation();
      
      // Estado final
      const finalState = {
         controllerComponents: window.slice.controller.activeComponents.size,
         rendererComponents: window.slice.router.routeRenderer.activeComponents.size,
         poolSize: window.slice.router.routeRenderer.componentPool.size,
         orphanedComponents: 0
      };
      
      // Contar componentes huérfanos finales
      for (const [sliceId, component] of window.slice.controller.activeComponents.entries()) {
         if (!component.isConnected && component !== window.slice.loading) {
            finalState.orphanedComponents++;
         }
      }
      
      console.log('\n📉 Estado final:');
      console.log(`   Controller: ${finalState.controllerComponents} componentes (${finalState.controllerComponents - initialState.controllerComponents > 0 ? '+' : ''}${finalState.controllerComponents - initialState.controllerComponents})`);
      console.log(`   Renderer: ${finalState.rendererComponents} componentes (${finalState.rendererComponents - initialState.rendererComponents > 0 ? '+' : ''}${finalState.rendererComponents - initialState.rendererComponents})`);
      console.log(`   Pool: ${finalState.poolSize} tipos (${finalState.poolSize - initialState.poolSize > 0 ? '+' : ''}${finalState.poolSize - initialState.poolSize})`);
      console.log(`   Huérfanos: ${finalState.orphanedComponents} componentes (${finalState.orphanedComponents - initialState.orphanedComponents > 0 ? '+' : ''}${finalState.orphanedComponents - initialState.orphanedComponents})`);
      
      // Análisis
      console.log('\n🔍 Análisis:');
      const controllerDiff = finalState.controllerComponents - initialState.controllerComponents;
      const rendererDiff = finalState.rendererComponents - initialState.rendererComponents;
      const orphanedDiff = finalState.orphanedComponents - initialState.orphanedComponents;
      
      if (controllerDiff === 0 && rendererDiff === 0) {
         console.log('   ✅ No se crearon componentes adicionales');
      } else {
         console.log(`   ⚠️  Se crearon ${controllerDiff} componentes en controller, ${rendererDiff} en renderer`);
      }
      
      if (orphanedDiff <= 0) {
         console.log('   ✅ No hay componentes huérfanos adicionales');
      } else {
         console.log(`   ❌ Se crearon ${orphanedDiff} componentes huérfanos adicionales`);
      }
      
      return {
         initialState,
         finalState,
         differences: {
            controller: controllerDiff,
            renderer: rendererDiff,
            orphaned: orphanedDiff
         },
         testResults: results
      };
   };

   // Función para test simple sin problemas complejos
   window.testSimple = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      console.log('🧪 Test simple de funcionalidad básica...');
      
      const results = {
         passed: 0,
         failed: 0,
         tests: []
      };

      // Test 1: Crear un componente simple
      const sliceId = `simple-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const component = await window.slice.build('Button', {
         value: 'Simple Test',
         sliceId: sliceId
      });

      if (component && component instanceof Node) {
         results.passed++;
         results.tests.push('✅ Componente se crea correctamente');
      } else {
         results.failed++;
         results.tests.push('❌ Componente no se crea correctamente');
      }

      // Test 2: Verificar que está en el controller
      const controllerComponent = window.slice.controller.getComponent(sliceId);
      if (controllerComponent === component) {
         results.passed++;
         results.tests.push('✅ Componente está en el controller');
      } else {
         results.failed++;
         results.tests.push('❌ Componente no está en el controller');
      }

      // Test 3: Verificar que se puede obtener
      const retrievedComponent = window.slice.controller.getComponent(sliceId);
      if (retrievedComponent) {
         results.passed++;
         results.tests.push('✅ Componente se puede obtener');
      } else {
         results.failed++;
         results.tests.push('❌ Componente no se puede obtener');
      }

      // Test 4: Verificar que se puede destruir
      const beforeCount = window.slice.controller.activeComponents.size;
      window.slice.router.routeRenderer.destroyComponent(component);
      const afterCount = window.slice.controller.activeComponents.size;

      if (afterCount < beforeCount) {
         results.passed++;
         results.tests.push('✅ Componente se destruye correctamente');
      } else {
         results.failed++;
         results.tests.push('❌ Componente no se destruye correctamente');
      }

      // Mostrar resultados
      console.log('\n📊 Resultados del test simple:');
      console.log(`   ✅ Pasados: ${results.passed}`);
      console.log(`   ❌ Fallidos: ${results.failed}`);
      results.tests.forEach(test => console.log(`   ${test}`));

      return results;
   };

   // Función para debug específico de reutilización
   window.debugReuse = async function() {
      if (!window.slice) {
         console.error('❌ Slice.js no está inicializado.');
         return;
      }

      console.log('🔍 Debug específico de reutilización...');
      
      const sliceId = `debug-reuse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Paso 1: Crear componente
      console.log(`Paso 1: Creando componente con sliceId: ${sliceId}`);
      const component1 = await window.slice.router.routeRenderer.getOrCreateComponent('Button', sliceId, {
         value: 'Debug Test'
      });
      
      if (!component1) {
         console.error('❌ No se pudo crear el componente');
         return;
      }
      
      console.log(`   Componente creado: ${component1.constructor.name}`);
      console.log(`   sliceId: ${component1.sliceId}`);
      console.log(`   Está en controller: ${window.slice.controller.getComponent(sliceId) ? 'Sí' : 'No'}`);
      
      // Paso 2: Verificar en controller
      const controllerComponent = window.slice.controller.getComponent(sliceId);
      console.log(`Paso 2: Verificando controller`);
      console.log(`   Componente en controller: ${controllerComponent ? controllerComponent.constructor.name : 'null'}`);
      console.log(`   Son iguales: ${component1 === controllerComponent}`);
      
      // Paso 3: Intentar reutilizar
      console.log(`Paso 3: Intentando reutilizar`);
      const beforeCount = window.slice.controller.activeComponents.size;
      const component2 = await window.slice.router.routeRenderer.getOrCreateComponent('Button', sliceId, {
         value: 'Debug Test Updated'
      });
      const afterCount = window.slice.controller.activeComponents.size;
      
      console.log(`   Contador: ${beforeCount} -> ${afterCount}`);
      console.log(`   Componente 2: ${component2 ? component2.constructor.name : 'null'}`);
      console.log(`   Son iguales: ${component1 === component2}`);
      
      // Análisis
      console.log(`\n📊 Análisis:`);
      if (component1 === component2) {
         console.log(`   ✅ Reutilización funciona`);
      } else {
         console.log(`   ❌ Reutilización falla`);
      }
      
      if (beforeCount === afterCount) {
         console.log(`   ✅ No se crearon componentes adicionales`);
      } else {
         console.log(`   ❌ Se crearon ${afterCount - beforeCount} componentes adicionales`);
      }
      
      // Limpiar
      window.slice.router.routeRenderer.destroyComponent(component1);
      
      return {
         component1,
         component2,
         areEqual: component1 === component2,
         countDiff: afterCount - beforeCount
      };
   };

   // Auto-ejecutar ayuda cuando se carga el archivo
   console.log('🧪 Sistema de testing de Slice.js cargado.');
   console.log('💡 Usa showTestingHelp() para ver los comandos disponibles.'); 