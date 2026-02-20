import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BarChartProps {
    data: { label: string; value: number; color?: string }[];
    title?: string;
    colors: any;
    maxValue?: number;
    horizontal?: boolean;
    showValues?: boolean;
    height?: number;
}

export function BarChart({ 
    data, 
    title, 
    colors, 
    maxValue: providedMax, 
    horizontal = false,
    showValues = true,
    height = 200 
}: BarChartProps) {
    const maxValue = providedMax || Math.max(...data.map(d => d.value), 1);
    
    if (horizontal) {
        return (
            <View style={styles.container}>
                {title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
                <View style={styles.horizontalChart}>
                    {data.map((item, index) => (
                        <View key={index} style={styles.horizontalBarRow}>
                            <Text style={[styles.horizontalLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                {item.label}
                            </Text>
                            <View style={styles.horizontalBarContainer}>
                                <View 
                                    style={[
                                        styles.horizontalBar, 
                                        { 
                                            width: `${(item.value / maxValue) * 100}%`,
                                            backgroundColor: item.color || colors.primary 
                                        }
                                    ]} 
                                />
                            </View>
                            {showValues && (
                                <Text style={[styles.horizontalValue, { color: colors.textPrimary }]}>
                                    {item.value}
                                </Text>
                            )}
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    const barWidth = Math.min(40, (SCREEN_WIDTH - 80) / data.length - 8);
    
    return (
        <View style={styles.container}>
            {title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
            <View style={[styles.chartContainer, { height }]}>
                {/* Y-axis labels */}
                <View style={styles.yAxis}>
                    <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>{maxValue}</Text>
                    <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>{Math.round(maxValue / 2)}</Text>
                    <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>0</Text>
                </View>
                
                {/* Bars */}
                <View style={styles.barsContainer}>
                    {data.map((item, index) => {
                        const barHeight = (item.value / maxValue) * (height - 40);
                        return (
                            <View key={index} style={styles.barWrapper}>
                                <View style={[styles.barColumn, { height: height - 40 }]}>
                                    <View 
                                        style={[
                                            styles.bar, 
                                            { 
                                                height: barHeight,
                                                width: barWidth,
                                                backgroundColor: item.color || colors.primary 
                                            }
                                        ]} 
                                    />
                                </View>
                                {showValues && (
                                    <Text style={[styles.valueLabel, { color: colors.textPrimary }]}>
                                        {item.value}
                                    </Text>
                                )}
                                <Text style={[styles.barLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {item.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

interface LineChartProps {
    data: { label: string; value: number }[];
    title?: string;
    colors: any;
    height?: number;
    color?: string;
}

export function LineChart({ data, title, colors, height = 180, color }: LineChartProps) {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const minValue = Math.min(...data.map(d => d.value), 0);
    const range = maxValue - minValue || 1;
    const chartWidth = SCREEN_WIDTH - 100;
    const chartHeight = height - 50;
    
    const points = data.map((item, index) => ({
        x: (index / (data.length - 1)) * chartWidth,
        y: chartHeight - ((item.value - minValue) / range) * chartHeight,
    }));

    return (
        <View style={styles.container}>
            {title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
            <View style={[styles.lineChartContainer, { height }]}>
                {/* Y-axis */}
                <View style={styles.yAxis}>
                    <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>{maxValue}</Text>
                    <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>{Math.round((maxValue + minValue) / 2)}</Text>
                    <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>{minValue}</Text>
                </View>
                
                {/* Chart area */}
                <View style={[styles.lineChartArea, { height: chartHeight }]}>
                    {/* Grid lines */}
                    <View style={[styles.gridLine, { top: 0, borderColor: colors.border }]} />
                    <View style={[styles.gridLine, { top: '50%', borderColor: colors.border }]} />
                    <View style={[styles.gridLine, { top: '100%', borderColor: colors.border }]} />
                    
                    {/* Data points and lines */}
                    {points.map((point, index) => (
                        <React.Fragment key={index}>
                            {/* Line to next point */}
                            {index < points.length - 1 && (
                                <View
                                    style={[
                                        styles.lineSegment,
                                        {
                                            left: point.x,
                                            top: point.y,
                                            width: Math.sqrt(
                                                Math.pow(points[index + 1].x - point.x, 2) +
                                                Math.pow(points[index + 1].y - point.y, 2)
                                            ),
                                            transform: [
                                                { rotate: `${Math.atan2(points[index + 1].y - point.y, points[index + 1].x - point.x)}rad` }
                                            ],
                                            backgroundColor: color || colors.primary,
                                        }
                                    ]}
                                />
                            )}
                            {/* Data point */}
                            <View
                                style={[
                                    styles.dataPoint,
                                    {
                                        left: point.x - 5,
                                        top: point.y - 5,
                                        backgroundColor: color || colors.primary,
                                        borderColor: colors.backgroundCard,
                                    }
                                ]}
                            />
                        </React.Fragment>
                    ))}
                </View>
                
                {/* X-axis labels */}
                <View style={styles.xAxisLabels}>
                    {data.map((item, index) => (
                        <Text 
                            key={index} 
                            style={[styles.xLabel, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            {item.label}
                        </Text>
                    ))}
                </View>
            </View>
        </View>
    );
}

interface PieChartProps {
    data: { label: string; value: number; color: string }[];
    title?: string;
    colors: any;
    size?: number;
}

export function PieChart({ data, title, colors, size = 150 }: PieChartProps) {
    const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
    let currentAngle = 0;
    
    // Create segments data with angles
    const segments = data.map(item => {
        const angle = (item.value / total) * 360;
        const segment = {
            ...item,
            startAngle: currentAngle,
            endAngle: currentAngle + angle,
            percentage: ((item.value / total) * 100).toFixed(1),
        };
        currentAngle += angle;
        return segment;
    });

    return (
        <View style={styles.container}>
            {title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
            <View style={styles.pieContainer}>
                {/* Simple circular representation using segments */}
                <View style={[styles.pieChart, { width: size, height: size }]}>
                    {segments.map((segment, index) => (
                        <View
                            key={index}
                            style={[
                                styles.pieSegment,
                                {
                                    width: size,
                                    height: size,
                                    borderRadius: size / 2,
                                    backgroundColor: 'transparent',
                                    borderWidth: size / 4,
                                    borderColor: segment.color,
                                    transform: [{ rotate: `${segment.startAngle}deg` }],
                                    borderTopColor: segment.color,
                                    borderRightColor: segment.endAngle - segment.startAngle > 90 ? segment.color : 'transparent',
                                    borderBottomColor: segment.endAngle - segment.startAngle > 180 ? segment.color : 'transparent',
                                    borderLeftColor: segment.endAngle - segment.startAngle > 270 ? segment.color : 'transparent',
                                }
                            ]}
                        />
                    ))}
                    {/* Center circle for donut effect */}
                    <View style={[styles.pieCenter, { 
                        width: size / 2, 
                        height: size / 2, 
                        backgroundColor: colors.backgroundCard,
                        borderRadius: size / 4,
                    }]}>
                        <Text style={[styles.pieCenterText, { color: colors.textPrimary }]}>{total}</Text>
                        <Text style={[styles.pieCenterLabel, { color: colors.textSecondary }]}>Total</Text>
                    </View>
                </View>
                
                {/* Legend */}
                <View style={styles.pieLegend}>
                    {segments.map((segment, index) => (
                        <View key={index} style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: segment.color }]} />
                            <Text style={[styles.legendLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                {segment.label}
                            </Text>
                            <Text style={[styles.legendValue, { color: colors.textPrimary }]}>
                                {segment.percentage}%
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

interface StatHighlightProps {
    value: string | number;
    label: string;
    icon?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    colors: any;
    size?: 'small' | 'large';
}

export function StatHighlight({ value, label, icon, trend, trendValue, colors, size = 'large' }: StatHighlightProps) {
    const getTrendColor = () => {
        if (trend === 'up') return '#27ae60';
        if (trend === 'down') return '#e74c3c';
        return colors.textSecondary;
    };
    
    const getTrendIcon = () => {
        if (trend === 'up') return '↑';
        if (trend === 'down') return '↓';
        return '→';
    };

    return (
        <View style={[styles.statHighlight, { backgroundColor: colors.backgroundCard }]}>
            {icon && <Text style={size === 'large' ? styles.statIcon : styles.statIconSmall}>{icon}</Text>}
            <Text style={[size === 'large' ? styles.statValue : styles.statValueSmall, { color: colors.primary }]}>
                {value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
            {trend && trendValue && (
                <View style={styles.trendContainer}>
                    <Text style={[styles.trendIcon, { color: getTrendColor() }]}>{getTrendIcon()}</Text>
                    <Text style={[styles.trendValue, { color: getTrendColor() }]}>{trendValue}</Text>
                </View>
            )}
        </View>
    );
}

interface DataTableProps {
    headers: string[];
    rows: (string | number)[][];
    colors: any;
}

export function DataTable({ headers, rows, colors }: DataTableProps) {
    return (
        <View style={[styles.table, { borderColor: colors.border }]}>
            <View style={[styles.tableHeader, { backgroundColor: colors.backgroundTertiary }]}>
                {headers.map((header, index) => (
                    <Text 
                        key={index} 
                        style={[
                            styles.tableHeaderCell, 
                            { color: colors.textPrimary },
                            index === 0 && { flex: 2 }
                        ]}
                    >
                        {header}
                    </Text>
                ))}
            </View>
            {rows.map((row, rowIndex) => (
                <View 
                    key={rowIndex} 
                    style={[
                        styles.tableRow, 
                        { borderBottomColor: colors.border },
                        rowIndex % 2 === 0 && { backgroundColor: colors.backgroundCard }
                    ]}
                >
                    {row.map((cell, cellIndex) => (
                        <Text 
                            key={cellIndex} 
                            style={[
                                styles.tableCell, 
                                { color: colors.textSecondary },
                                cellIndex === 0 && { flex: 2, color: colors.textPrimary }
                            ]}
                        >
                            {cell}
                        </Text>
                    ))}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    // Horizontal Bar Chart
    horizontalChart: {
        gap: 12,
    },
    horizontalBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    horizontalLabel: {
        width: 60,
        fontSize: 12,
        marginRight: 8,
    },
    horizontalBarContainer: {
        flex: 1,
        height: 24,
        backgroundColor: 'rgba(128, 128, 128, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    horizontalBar: {
        height: '100%',
        borderRadius: 4,
    },
    horizontalValue: {
        width: 45,
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'right',
        marginLeft: 8,
    },
    // Vertical Bar Chart
    chartContainer: {
        flexDirection: 'row',
    },
    yAxis: {
        width: 35,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingRight: 8,
        paddingBottom: 25,
    },
    axisLabel: {
        fontSize: 10,
    },
    barsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
    },
    barWrapper: {
        alignItems: 'center',
    },
    barColumn: {
        justifyContent: 'flex-end',
    },
    bar: {
        borderRadius: 4,
    },
    valueLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    },
    barLabel: {
        fontSize: 10,
        marginTop: 4,
        maxWidth: 50,
        textAlign: 'center',
    },
    // Line Chart
    lineChartContainer: {
        flexDirection: 'row',
    },
    lineChartArea: {
        flex: 1,
        marginLeft: 8,
        position: 'relative',
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: 1,
        borderStyle: 'dashed',
    },
    lineSegment: {
        position: 'absolute',
        height: 2,
        transformOrigin: 'left center',
    },
    dataPoint: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
    },
    xAxisLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        marginLeft: 43,
    },
    xLabel: {
        fontSize: 10,
        maxWidth: 50,
        textAlign: 'center',
    },
    // Pie Chart
    pieContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    pieChart: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pieSegment: {
        position: 'absolute',
    },
    pieCenter: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pieCenterText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    pieCenterLabel: {
        fontSize: 10,
    },
    pieLegend: {
        flex: 1,
        marginLeft: 20,
        gap: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 3,
        marginRight: 8,
    },
    legendLabel: {
        flex: 1,
        fontSize: 12,
    },
    legendValue: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Stat Highlight
    statHighlight: {
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        flex: 1,
        margin: 4,
    },
    statIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    statIconSmall: {
        fontSize: 24,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    statValueSmall: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    trendIcon: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    trendValue: {
        fontSize: 12,
        marginLeft: 4,
    },
    // Data Table
    table: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    tableHeaderCell: {
        flex: 1,
        fontWeight: '600',
        fontSize: 12,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
    },
});
