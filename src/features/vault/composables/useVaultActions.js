import { ref } from 'vue'
import { updateVaultAccount, moveToTrash } from '@/features/vault/service/vaultApi'
import { i18n } from '@/locales/index.js'
import { buildOtpUri } from '@/shared/utils/totp'
import QRCode from 'qrcode'


export function useVaultActions(stateStore) {
    const { loadVault, confirmModal, showToast } = stateStore
    const { t } = i18n.global

    // 编辑弹窗状态
    const isEditModalOpen = ref(false)
    const isEditing = ref(false)
    const editData = ref({ id: '', service: '', account: '', category: '' })

    // 导出弹窗状态
    const isExportModalOpen = ref(false)
    const exportData = ref(null)
    const exportUri = ref('')
    const qrCodeUrl = ref('')

    // 统一命令处理
    const handleCommand = (cmd, item) => {
        if (cmd === 'edit') openEditModal(item)
        else if (cmd === 'export') openExportModal(item)
        else if (cmd === 'delete') deleteAccount(item)
    }

    const openEditModal = (item) => {
        editData.value = {
            id: item.id,
            service: item.service,
            account: item.account,
            category: item.category === 'uncategorized' ? '' : (item.category || '')
        }
        isEditModalOpen.value = true
    }

    const submitEditVault = async () => {
        if (isEditing.value) return
        isEditing.value = true
        try {
            const { id, ...data } = editData.value
            await updateVaultAccount(id, data)
            isEditModalOpen.value = false
            showToast(t('vault.save_success'))
            await loadVault() // 刷新列表
        } catch (e) {
            showToast(e.message || 'Error', 'error')
        } finally {
            isEditing.value = false
        }
    }

    const openExportModal = async (item) => {
        exportData.value = item
        const uri = buildOtpUri({
            service: item.service,
            account: item.account,
            secret: item.decryptedSecret,
            type: item.type,
            algorithm: item.algorithm,
            digits: item.digits,
            period: item.period,
            counter: item.counter
        })
        exportUri.value = uri
        qrCodeUrl.value = await QRCode.toDataURL(uri, { width: 240, margin: 1 })
        isExportModalOpen.value = true
    }

    const deleteAccount = async (item) => {
        confirmModal.value = {
            open: true,
            title: t('common.delete'),
            desc: t('vault.delete_confirm', { service: item.service }),
            confirmText: t('common.delete'),
            action: async () => {
                try {
                    // 扩展端默认全部采用软删除（移入回收站），保障数据安全
                    await moveToTrash(item.id)
                    showToast(t('vault.delete_success'))
                    confirmModal.value.open = false // 修复：操作完成后必须关闭弹窗
                    await loadVault()
                } catch (e) {
                    showToast(e.message || 'Error', 'error')
                }
            }
        }
    }

    return {
        isEditModalOpen,
        isEditing,
        editData,
        isExportModalOpen,
        exportData,
        exportUri,
        qrCodeUrl,
        handleCommand,
        submitEditVault
    }
}
