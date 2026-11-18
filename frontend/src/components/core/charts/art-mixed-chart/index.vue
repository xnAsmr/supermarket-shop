<!-- 销售总览组合图：双柱（订单总量/销售总额）+ 折线（营收），样式对齐 Art Design Pro X -->
<template>
  <div ref="chartRef" :style="{ height: props.height }" v-loading="props.loading"></div>
</template>

<script setup lang="ts">
  import { type EChartsOption } from '@/plugins/echarts'
  import { useChartOps, useChartComponent } from '@/hooks/core/useChart'

  defineOptions({ name: 'ArtMixedChart' })

  interface Props {
    /** 图表高度 */
    height?: string
    /** 是否加载中 */
    loading?: boolean
    /** 是否空数据 */
    isEmpty?: boolean
    /** X 轴类目标签 */
    xAxisData: string[]
    /** 订单总量（柱一，蓝色） */
    orderData: number[]
    /** 销售总额（柱二，青绿色） */
    salesData: number[]
    /** 营收（折线，橙色） */
    profitData: number[]
    /** 系列名称 */
    orderName?: string
    salesName?: string
    profitName?: string
    /** 系列配色 */
    orderColor?: string
    salesColor?: string
    profitColor?: string
    /** 柱状图宽度 */
    barWidth?: string | number
    /** 交互配置 */
    showTooltip?: boolean
    showLegend?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    height: useChartOps().chartHeight,
    loading: false,
    isEmpty: false,
    orderName: '订单总量',
    salesName: '销售总额',
    profitName: '营收',
    orderColor: '#3D7FFF',
    salesColor: '#2ED3B7',
    profitColor: '#FFB200',
    barWidth: '38%',
    showTooltip: true,
    showLegend: true
  })

  /** 提示框格式化：金额系列补 ¥，订单系列补「单」 */
  const tooltipFormatter = (params: any) => {
    if (!params?.length) return ''
    let html = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`
    params.forEach((p: any) => {
      const isOrders = p.seriesName === props.orderName
      const value = isOrders
        ? `${p.value ?? 0} 单`
        : `¥ ${Number(p.value || 0).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`
      html += `<div style="display:flex;align-items:center;gap:6px;line-height:20px">${p.marker}${p.seriesName}：<b>${value}</b></div>`
    })
    return html
  }

  const {
    chartRef,
    isDark,
    getAxisTickStyle,
    getAxisLabelStyle,
    getSplitLineStyle,
    getAnimationConfig,
    getTooltipStyle
  } = useChartComponent({
    props,
    checkEmpty: () => {
      const isEmptySeries = (data: number[]) => !data?.length || data.every((v) => v === 0)
      return isEmptySeries(props.orderData) && isEmptySeries(props.salesData) && isEmptySeries(props.profitData)
    },
    watchSources: [
      () => props.orderData,
      () => props.salesData,
      () => props.profitData,
      () => props.xAxisData
    ],
    generateOptions: (): EChartsOption => {
      const legendColor = isDark.value ? 'rgba(255, 255, 255, 0.72)' : '#666'

      return {
        grid: { top: 42, right: 8, bottom: 0, left: 0, containLabel: true },
        tooltip: props.showTooltip
          ? getTooltipStyle('axis', { formatter: tooltipFormatter })
          : undefined,
        // 图例：左上角，小圆点图标（对齐 Art Design Pro X）
        legend: props.showLegend
          ? {
              top: 0,
              left: 0,
              icon: 'circle',
              itemWidth: 10,
              itemHeight: 10,
              itemGap: 24,
              data: [props.orderName, props.salesName, props.profitName],
              textStyle: { color: legendColor, fontSize: 13 }
            }
          : undefined,
        xAxis: {
          type: 'category',
          data: props.xAxisData,
          axisTick: getAxisTickStyle(),
          axisLine: { show: false },
          axisLabel: getAxisLabelStyle(true)
        },
        yAxis: [
          // 左轴：金额（销售总额/营收），虚线网格
          {
            type: 'value',
            axisLine: { show: false },
            axisTick: getAxisTickStyle(),
            axisLabel: getAxisLabelStyle(true),
            splitLine: getSplitLineStyle(true)
          },
          // 右轴：订单量（隐藏刻度，量纲独立，真实值经提示框展示）
          { type: 'value', show: false }
        ],
        series: [
          {
            name: props.orderName,
            type: 'bar',
            yAxisIndex: 1,
            data: props.orderData,
            barWidth: props.barWidth,
            barGap: '20%',
            itemStyle: { color: props.orderColor, borderRadius: [3, 3, 0, 0] },
            ...getAnimationConfig()
          },
          {
            name: props.salesName,
            type: 'bar',
            yAxisIndex: 0,
            data: props.salesData,
            barWidth: props.barWidth,
            itemStyle: { color: props.salesColor, borderRadius: [3, 3, 0, 0] },
            ...getAnimationConfig()
          },
          {
            name: props.profitName,
            type: 'line',
            yAxisIndex: 0,
            data: props.profitData,
            smooth: true,
            showSymbol: false,
            z: 3,
            lineStyle: { width: 3, color: props.profitColor },
            itemStyle: { color: props.profitColor }
          }
        ]
      }
    }
  })
</script>
