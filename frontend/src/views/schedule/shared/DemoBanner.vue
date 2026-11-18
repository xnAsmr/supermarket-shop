<!-- 数据来源标签：明确提示当前排班数据来自真实后端还是本地演示数据 -->
<template>
  <div class="demo-banner" :class="{ 'is-live': !SCHEDULE_MOCK_ONLY }">
    <span class="demo-banner__tag">
      <ArtSvgIcon :icon="SCHEDULE_MOCK_ONLY ? 'ri:flask-line' : 'ri:database-2-line'" />
      {{ SCHEDULE_MOCK_ONLY ? '演示数据' : '真实数据' }}
    </span>
    <span class="demo-banner__text">
      <template v-if="SCHEDULE_MOCK_ONLY">
        当前使用前端本地演示数据（localStorage），未请求后端；可在
        <code>api/schedule.ts</code> 中把 <code>SCHEDULE_MOCK_ONLY</code> 置为 false 切换。
      </template>
      <template v-else>
        排班数据来自后端 <code>/api/v1/schedule/*</code>，已持久化到
        <code>sch_shift</code> / <code>sch_schedule</code> / <code>sch_schedule_item</code> /
        <code>sch_shift_change</code>，按租户与门店隔离，刷新后仍然保留。
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
  import { SCHEDULE_MOCK_ONLY } from '@/api/schedule'
</script>

<style lang="scss" scoped>
  .demo-banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 9px 14px;
    margin-bottom: 14px;
    border: 1px solid #f5e2a8;
    border-radius: 10px;
    background: #fffaf0;
    font-size: 12px;
    color: #96690b;

    &.is-live {
      border-color: #b7e3d5;
      background: #f2fbf7;
      color: #187a5f;

      .demo-banner__tag {
        background: #2ed3b7;
      }
    }

    &__tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 9px;
      border-radius: 5px;
      background: #f5c518;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    &__text {
      line-height: 1.6;

      code {
        padding: 1px 4px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.05);
        font-size: 11px;
      }
    }
  }

  .dark .demo-banner {
    border-color: #6b5520;
    background: #3a3117;
    color: #e8c977;

    &.is-live {
      border-color: #1c5b4a;
      background: #14362c;
      color: #9fe3cf;
    }
  }
</style>
