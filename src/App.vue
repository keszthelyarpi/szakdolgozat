<script setup lang="ts">
import EditorView from './views/EditorView.vue';
</script>

<template>
  <EditorView />
</template>

<style>
/* Global CAD Application CSS */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #090d16;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #f8fafc;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
}

::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.6);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.9);
}
</style>
