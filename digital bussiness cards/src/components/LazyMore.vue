<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  stamp: { type: Number, default: 0 },
  loaded: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
})
const emit = defineEmits(['more'])
const el = ref(null)
let observer = null
let pending = false

function inView() {
  const node = el.value
  if (!node) return false
  const rect = node.getBoundingClientRect()
  const height = window.innerHeight || document.documentElement.clientHeight || 0
  return rect.top <= height + 320 && rect.bottom >= -80
}

function requestMore() {
  if (pending || !inView()) return
  pending = true
  emit('more')
}

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) requestMore()
  }, { root: null, rootMargin: '320px 0px' })
  if (el.value) observer.observe(el.value)
  requestMore()
})

watch(
  () => props.stamp,
  async () => {
    pending = false
    await nextTick()
    requestMore()
  }
)

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="el" class="py-2 text-center text-[11px] text-gray-500">
    Showing {{ loaded }} of {{ total }}
  </div>
</template>
