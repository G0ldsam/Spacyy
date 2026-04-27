'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/contexts/LanguageContext'

export default function SetupAccountPage() {
    const { t } = useLanguage()
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        // Only access window in useEffect which runs on the client
        if (globalThis.window !== undefined) {
            const params = new URLSearchParams(globalThis.location.search)
            const emailParam = params.get('email')
            const codeParam = params.get('code')

            if (emailParam) setEmail(emailParam)
            if (codeParam) setCode(codeParam)
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (newPassword.length < 8) {
            setError(t('setup_account.error_length'))
            return
        }

        if (newPassword !== confirmPassword) {
            setError(t('setup_account.error_match'))
            return
        }

        if (!email || !code) {
            setError(t('setup_account.error_invalid_link'))
            return
        }

        setLoading(true)

        try {
            // 1. Silently sign in the user using the temporary credentials from the QR Code
            const result = await signIn('credentials', {
                email,
                password: code,
                redirect: false,
            })

            if (result?.error) {
                throw new Error(t('setup_account.error_expired'))
            }

            // 2. Complete the setup by setting the new password using the established session logic
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: code,
                    newPassword,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || t('setup_account.error_password'))
            }

            // 3. User is securely set up and logged in, redirect them seamlessly to their space
            window.location.href = '/home'
        } catch (err: any) {
            setError(err.message || t('setup_account.error_generic'))
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 mobile-container">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl sm:text-3xl">{t('setup_account.title')}</CardTitle>
                    <CardDescription className="text-base text-gray-600">
                        {t('setup_account.subtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="newPassword" className="text-sm font-medium text-gray-900">
                                {t('setup_account.new_label')}
                            </label>
                            <Input
                                id="newPassword"
                                type="password"
                                placeholder={t('setup_account.new_placeholder')}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="h-12 text-base"
                                required
                                minLength={8}
                            />
                            <p className="text-xs text-gray-600">{t('setup_account.new_hint')}</p>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-900">
                                {t('setup_account.confirm_label')}
                            </label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder={t('setup_account.confirm_placeholder')}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="h-12 text-base"
                                required
                                minLength={8}
                            />
                        </div>

                        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                            {loading ? t('setup_account.submitting') : t('setup_account.submit')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
