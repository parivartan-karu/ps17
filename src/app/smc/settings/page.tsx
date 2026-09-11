'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Shield, Settings, Users, Building, Clock } from 'lucide-react';
import { departments, departmentConfig } from '@/lib/constants';
import LanguageSelector from '@/components/translation/language-selector';

export default function SmcSettingsPage() {
    return (
        <div className="space-y-8">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 md:p-8 rounded-lg shadow-lg">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">System Settings</h1>
                <p className="text-base md:text-lg">Configure platform behavior and preferences</p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                    <TabsList className="inline-flex w-max md:w-auto mb-4">
                        <TabsTrigger value="general" className="gap-2">
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">General</span>
                        </TabsTrigger>
                        <TabsTrigger value="departments" className="gap-2">
                            <Building className="h-4 w-4" />
                            <span className="hidden sm:inline">Departments</span>
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-2">
                            <Bell className="h-4 w-4" />
                            <span className="hidden sm:inline">Notifications</span>
                        </TabsTrigger>
                        <TabsTrigger value="sla" className="gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="hidden sm:inline">SLA Config</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>Configure general platform settings</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <Label>Auto AI Analysis</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically run AI damage assessment on new reports
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <Label>Auto Department Assignment</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Use AI suggestions to auto-assign departments
                                    </p>
                                </div>
                                <Switch />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <Label>Public Leaderboard</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Show citizen contributions on public leaderboard
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label>Default Resolution Time (Hours)</Label>
                                <Input type="number" placeholder="72" defaultValue="72" className="max-w-xs" />
                                <p className="text-sm text-muted-foreground">
                                    Default estimated time for report resolution
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button>Save Changes</Button>
                        </CardFooter>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Language</CardTitle>
                            <CardDescription>Select your preferred app language.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <LanguageSelector />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="departments">
                    <Card>
                        <CardHeader>
                            <CardTitle>Department Configuration</CardTitle>
                            <CardDescription>Manage department settings and heads</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {departments.map((dept) => (
                                <div key={dept} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${departmentConfig[dept]?.color || 'bg-gray-500'}`} />
                                        <div>
                                            <p className="font-medium">{dept}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {departmentConfig[dept]?.description || 'No description'}
                                            </p>
                                        </div>
                                    </div>
                                    <Select defaultValue="unassigned">
                                        <SelectTrigger className="w-full sm:w-[200px]">
                                            <SelectValue placeholder="Select Department Head" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">No Head Assigned</SelectItem>
                                            <SelectItem value="officer1">Rajesh Kumar</SelectItem>
                                            <SelectItem value="officer2">Priya Sharma</SelectItem>
                                            <SelectItem value="officer3">Amit Patel</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter>
                            <Button>Save Department Settings</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notification Settings</CardTitle>
                            <CardDescription>Configure notification preferences for the platform</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <Label>Email Alerts for Critical Reports</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Send email when critical priority reports are submitted
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <Label>Daily Digest Email</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Send daily summary of reports and resolutions
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <Label>SLA Breach Alerts</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Alert when reports exceed estimated resolution time
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button>Save Notification Settings</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="sla">
                    <Card>
                        <CardHeader>
                            <CardTitle>SLA Configuration</CardTitle>
                            <CardDescription>Set service level agreements by priority</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 p-4 border rounded-lg">
                                    <Label className="text-red-600 font-semibold">Critical Priority</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" defaultValue="24" className="w-24" />
                                        <span className="text-sm text-muted-foreground">hours</span>
                                    </div>
                                </div>
                                <div className="space-y-2 p-4 border rounded-lg">
                                    <Label className="text-orange-600 font-semibold">High Priority</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" defaultValue="48" className="w-24" />
                                        <span className="text-sm text-muted-foreground">hours</span>
                                    </div>
                                </div>
                                <div className="space-y-2 p-4 border rounded-lg">
                                    <Label className="text-yellow-600 font-semibold">Medium Priority</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" defaultValue="72" className="w-24" />
                                        <span className="text-sm text-muted-foreground">hours</span>
                                    </div>
                                </div>
                                <div className="space-y-2 p-4 border rounded-lg">
                                    <Label className="text-green-600 font-semibold">Low Priority</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" defaultValue="168" className="w-24" />
                                        <span className="text-sm text-muted-foreground">hours (7 days)</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button>Save SLA Settings</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
