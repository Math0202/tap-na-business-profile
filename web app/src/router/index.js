import { createRouter, createWebHistory } from 'vue-router'
import {
  loadProfile,
  isTableBusiness,
  isProfileDeleted,
  isLoggedIn,
  hasCredentials,
  requireLogin
} from '../lib/profileStore'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/cart',
    name: 'cart',
    component: () => import('../views/CartView.vue')
  },
  {
    path: '/me',
    name: 'my-card',
    component: () => import('../views/MyCardView.vue')
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/shop/login',
    name: 'shop-login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('../views/SignupView.vue')
  },
  {
    path: '/cards',
    name: 'cards',
    component: () => import('../views/CardsView.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue')
  },
  {
    path: '/business',
    name: 'business',
    component: () => import('../views/BusinessView.vue')
  },
  {
    path: '/table',
    name: 'table',
    component: () => import('../views/TableProductsView.vue')
  },
  {
    path: '/checkin',
    name: 'checkin',
    component: () => import('../views/CheckInView.vue')
  },
  {
    path: '/feedback',
    name: 'feedback',
    component: () => import('../views/FeedbackView.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminDashboardView.vue')
  },
  {
    path: '/admin/profiles/:id',
    name: 'admin-profile',
    component: () => import('../views/AdminProfileDetailView.vue')
  },
  {
    path: '/admin/slugs',
    name: 'admin-slugs',
    component: () => import('../views/AdminSlugsView.vue')
  },
  {
    path: '/admin/sales',
    name: 'admin-sales',
    component: () => import('../views/SalesModuleView.vue'),
    beforeEnter: (to) => {
      if (to.query.tab === 'slugs') return '/admin/slugs'
    }
  },
  {
    path: '/admin/shop',
    name: 'admin-shop',
    component: () => import('../views/AdminShopView.vue')
  },
  {
    path: '/venue',
    name: 'venue-dashboard',
    component: () => import('../views/VenueDashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/c/:serial',
    name: 'card-tap',
    component: () => import('../views/CardTapView.vue')
  },
  {
    path: '/setup',
    name: 'card-setup',
    component: () => import('../views/CardSetupView.vue')
  },
  {
    path: '/products',
    redirect: '/cards'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  const profile = loadProfile()

  if (to.path === '/me' && isTableBusiness(profile) && !isProfileDeleted(profile)) {
    return '/business'
  }

  if (to.meta.requiresAuth) {
    if (!isLoggedIn() && hasCredentials()) {
      return { path: '/login', query: { next: to.fullPath } }
    }
    requireLogin()
  }

  return true
})

export default router
