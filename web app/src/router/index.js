import { createRouter, createWebHistory } from 'vue-router'
import {
  loadProfile,
  isTableBusiness,
  isProfileDeleted,
  isLoggedIn,
  hasCredentials,
  requireLogin
} from '../lib/profileStore'
import {
  isStaffLoggedIn,
  isStaffSalesTeam,
  staffCanAccessAdminPath
} from '../lib/staffAuth'
import { ROUTE_SEO, setPageSeo } from '../lib/seo'
import { syncPosthogForRoute } from '../lib/posthog'
import { personalPagePath, slugForLegacyPersonalRedirect } from '../lib/profilePaths'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { seoKey: 'home' }
  },
  {
    path: '/cart',
    name: 'cart',
    component: () => import('../views/CartView.vue'),
    meta: { seoKey: 'cart' }
  },
  {
    path: '/venue-display',
    name: 'venue-display-shop',
    component: () => import('../views/TableTopShopView.vue'),
    meta: { seoKey: 'venue-display' }
  },
  {
    path: '/product/:id',
    name: 'shop-product',
    component: () => import('../views/ShopProductView.vue'),
    meta: { seoKey: 'shop-product' }
  },
  {
    path: '/package/team',
    name: 'team-package',
    component: () => import('../views/TeamPackageView.vue'),
    meta: { seoKey: 'team-package' }
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
    component: () => import('../views/LoginView.vue'),
    meta: { seoKey: 'login' }
  },
  {
    path: '/shop/login',
    name: 'shop-login',
    component: () => import('../views/LoginView.vue'),
    meta: { seoKey: 'login' }
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('../views/SignupView.vue'),
    meta: { seoKey: 'signup' }
  },
  {
    path: '/cards',
    name: 'cards',
    component: () => import('../views/CardsView.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    meta: { seoKey: 'about' }
  },
  {
    path: '/about/business-cards',
    name: 'about-business-cards',
    component: () => import('../views/AboutBusinessCardsView.vue'),
    meta: { seoKey: 'about-business-cards' }
  },
  {
    path: '/support',
    name: 'support',
    component: () => import('../views/SupportView.vue'),
    meta: { seoKey: 'support' }
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
    path: '/menu',
    name: 'menu',
    component: () => import('../views/MenuView.vue')
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('../views/AdminLoginView.vue'),
    meta: { staffPublic: true }
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminDashboardView.vue'),
    meta: { requiresStaff: true, staffRoles: ['admin'] }
  },
  {
    path: '/admin/profiles/:id',
    name: 'admin-profile',
    component: () => import('../views/AdminProfileDetailView.vue'),
    meta: { requiresStaff: true, staffRoles: ['admin'] }
  },
  {
    path: '/admin/profiles/:id/activities',
    name: 'admin-profile-activities',
    component: () => import('../views/AdminProfileActivitiesView.vue'),
    meta: { requiresStaff: true, staffRoles: ['admin'] }
  },
  {
    path: '/admin/slugs',
    name: 'admin-slugs',
    component: () => import('../views/AdminSlugsView.vue'),
    meta: { requiresStaff: true, staffRoles: ['admin'] }
  },
  {
    path: '/admin/sales',
    name: 'admin-sales',
    component: () => import('../views/SalesModuleView.vue'),
    meta: { requiresStaff: true, staffRoles: ['admin', 'sales'] },
    beforeEnter: (to) => {
      if (to.query.tab === 'slugs') return '/admin/slugs'
    }
  },
  {
    path: '/admin/shop',
    name: 'admin-shop',
    component: () => import('../views/AdminShopView.vue'),
    meta: { requiresStaff: true, staffRoles: ['admin'] }
  },
  {
    path: '/venue',
    name: 'venue-dashboard',
    component: () => import('../views/VenueDashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/meetings',
    name: 'meetings',
    component: () => import('../views/MeetingsView.vue')
  },
  {
    path: '/catalog',
    name: 'catalog',
    component: () => import('../views/CatalogView.vue')
  },
  {
    path: '/catalog-cart',
    name: 'catalog-cart',
    component: () => import('../views/ProfileCatalogCartView.vue')
  },
  {
    path: '/team',
    name: 'team',
    component: () => import('../views/TeamView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/c/:serial/catalog',
    name: 'card-catalog',
    component: () => import('../views/CatalogView.vue')
  },
  {
    path: '/c/:serial/catalog-cart',
    name: 'card-catalog-cart',
    component: () => import('../views/ProfileCatalogCartView.vue')
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

  if (to.path === '/me' || to.path === '/catalog' || to.path === '/catalog-cart') {
    const slug = slugForLegacyPersonalRedirect(to.path)
    if (slug) {
      const page =
        to.path === '/catalog' ? 'catalog' : to.path === '/catalog-cart' ? 'catalog-cart' : 'profile'
      return { path: personalPagePath(slug, page), query: to.query, hash: to.hash }
    }
  }

  // Staff area — home and /c/:serial stay public
  if (to.path.startsWith('/admin') && !to.meta.staffPublic) {
    if (!isStaffLoggedIn()) {
      return { path: '/login', query: { next: to.fullPath } }
    }
    if (!staffCanAccessAdminPath(to.path)) {
      return isStaffSalesTeam() ? '/admin/sales' : '/login'
    }
    if (to.meta.staffRoles?.length) {
      const role = isStaffSalesTeam() ? 'sales' : 'admin'
      if (!to.meta.staffRoles.includes(role)) {
        return role === 'sales' ? '/admin/sales' : '/admin'
      }
    }
  }

  if (to.meta.requiresAuth) {
    if (!isLoggedIn() && hasCredentials()) {
      return { path: '/login', query: { next: to.fullPath } }
    }
    requireLogin()
  }

  return true
})

router.afterEach((to) => {
  syncPosthogForRoute(to)
  const key = to.meta?.seoKey
  const preset = key ? ROUTE_SEO[key] : null
  if (!preset) return
  // Product pages set richer SEO after load; apply a sensible default first.
  setPageSeo({
    title: preset.title,
    description: preset.description,
    path: to.path,
    image: preset.image,
    noindex: !!preset.noindex
  })
})

export default router
