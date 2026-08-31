<script setup>
import { MEETING_TOOLS, CRM_PROVIDERS } from '../lib/teamIntegrations'

defineProps({
  meetingTool: { type: String, default: '' },
  usesCrm: { type: Boolean, default: false },
  crmProvider: { type: String, default: '' },
  crmOther: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:meetingTool', 'update:usesCrm', 'update:crmProvider', 'update:crmOther'])
</script>

<template>
  <div class="space-y-4 text-left">
    <div class="field-group">
      <label class="field-label" for="meeting-tool-select">Meeting calendar</label>
      <p class="text-[12px] text-gray-500 mb-2 leading-snug">
        Guests see this calendar option on booking emails.
      </p>
      <div class="field-shell">
        <span class="material-symbols-outlined field-icon">event</span>
        <select
          id="meeting-tool-select"
          class="field-input"
          :value="meetingTool"
          :disabled="disabled"
          @change="emit('update:meetingTool', $event.target.value)"
        >
          <option value="">Choose calendar…</option>
          <option v-for="tool in MEETING_TOOLS" :key="tool.id" :value="tool.id">
            {{ tool.label }}
          </option>
        </select>
      </div>
    </div>

    <label class="flex items-start gap-3 cursor-pointer">
      <input
        :checked="usesCrm"
        type="checkbox"
        class="mt-1 rounded border-zinc-600"
        :disabled="disabled"
        @change="emit('update:usesCrm', $event.target.checked)"
      >
      <span class="min-w-0">
        <span class="block text-sm font-semibold">We use CRM</span>
        <span class="block text-[12px] text-gray-500 mt-0.5 leading-snug">
          Add a CRM button on your meeting emails so you can save the guest as a lead.
        </span>
      </span>
    </label>

    <div v-if="usesCrm" class="field-group">
      <label class="field-label" for="crm-provider-select">Which CRM?</label>
      <div class="field-shell">
        <span class="material-symbols-outlined field-icon">hub</span>
        <select
          id="crm-provider-select"
          class="field-input"
          :value="crmProvider"
          :disabled="disabled"
          @change="emit('update:crmProvider', $event.target.value)"
        >
          <option value="">Choose CRM…</option>
          <option v-for="crm in CRM_PROVIDERS" :key="crm.id" :value="crm.id">
            {{ crm.label }}
          </option>
        </select>
      </div>
      <div v-if="crmProvider === 'other'" class="mt-3">
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="crm-other">
          CRM name
        </label>
        <input
          id="crm-other"
          :value="crmOther"
          type="text"
          class="field-input w-full"
          placeholder="e.g. Custom CRM"
          maxlength="80"
          :disabled="disabled"
          @input="emit('update:crmOther', $event.target.value)"
        >
      </div>
    </div>
  </div>
</template>
