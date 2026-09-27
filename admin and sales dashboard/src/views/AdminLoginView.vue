<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isStaffLoggedIn } from '../lib/staffAuth'
import { staffHomePath } from '../lib/authRedirect'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  // #region agent log
  fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'pre-fix',hypothesisId:'D',location:'AdminLoginView.vue:onMounted',message:'admin/login redirect shim',data:{host:typeof window!=='undefined'?window.location.hostname:'',href:typeof window!=='undefined'?window.location.href:'',query:route.query,staff:isStaffLoggedIn()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (isStaffLoggedIn()) {
    router.replace(staffHomePath())
    return
  }
  const q = { ...route.query }
  router.replace({ path: '/login', query: q })
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <p class="text-sm text-gray-400">Redirecting to login…</p>
  </main>
</template>