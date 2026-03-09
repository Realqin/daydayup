import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Upload,
  Space,
} from "antd";
import type { Category, KnowledgePoint } from "../api/client";
import { api } from "../api/client";
import dayjs from "dayjs";

export default function Knowledge() {
  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgePoint | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadCategories = async () => {
    const { data } = await api.get<Category[]>("/categories");
    setCategories(data);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = filterCategory ? { category_id: filterCategory } : {};
      const { data } = await api.get<KnowledgePoint[]>("/knowledge", { params });
      setList(data);
    } catch (e) {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    load();
  }, [filterCategory]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    values.push_date = values.push_date?.format("YYYY-MM-DD");
    try {
      if (editing) {
        await api.put(`/knowledge/${editing.id}`, { ...values, category_id: undefined });
        message.success("更新成功");
      } else {
        await api.post("/knowledge", values);
        message.success("创建成功");
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch (e) {
      message.error("操作失败");
    }
  };

  const handleEdit = (row: KnowledgePoint) => {
    setEditing(row);
    form.setFieldsValue({ ...row, push_date: row.push_date ? dayjs(row.push_date) : null });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/knowledge/${id}`);
      message.success("删除成功");
      load();
    } catch (e) {
      message.error("删除失败");
    }
  };

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCategory, setImportCategory] = useState<string | null>(null);

  const handleImport = async (file: File) => {
    if (!importCategory) {
      message.warning("请先选择要导入的分类");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/knowledge/import?category_id=${importCategory}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success(`导入成功，新增 ${data.created} 条`);
      setImportModalOpen(false);
      setImportCategory(null);
      load();
    } catch (e) {
      message.error("导入失败");
    }
  };

  const handleExport = async (categoryId: string) => {
    try {
      const { data } = await api.get(`/knowledge/export/${categoryId}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `knowledge_${categoryId}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      message.success("导出成功");
    } catch (e) {
      message.error("导出失败");
    }
  };

  return (
    <div style={{ padding: 24, background: "#fff", minHeight: "100%" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Space align="center">
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>知识点</h2>
          <Select
            placeholder="筛选分类"
            allowClear
            style={{ width: 160 }}
            onChange={(v) => setFilterCategory(v ?? null)}
          >
            {categories.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.icon} {c.name}</Select.Option>
            ))}
          </Select>
        </Space>
        <Space>
          <Button onClick={() => setImportModalOpen(true)}>导入</Button>
          <Button
            disabled={!filterCategory}
            onClick={() => filterCategory && handleExport(filterCategory)}
          >
            导出当前分类
          </Button>
          <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            新增知识点
          </Button>
        </Space>
      </div>
      <Table
        loading={loading}
        dataSource={list}
        rowKey="id"
        scroll={{ x: 600 }}
        columns={[
          { title: "标题", dataIndex: "title", ellipsis: true, width: 200 },
          {
            title: "分类",
            dataIndex: "category_id",
            width: 120,
            ellipsis: true,
            render: (id) => categories.find((c) => c.id === id)?.name ?? id,
          },
          { title: "推送日期", dataIndex: "push_date", width: 120 },
          {
            title: "操作",
            width: 160,
            render: (_, row) => (
              <>
                <Button type="link" size="small" onClick={() => handleEdit(row)}>编辑</Button>
                <Button type="link" size="small" danger onClick={() => handleDelete(row.id)}>删除</Button>
              </>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "编辑知识点" : "新增知识点"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="分类" rules={[{ required: true }]}>
            <Select placeholder="选择分类" disabled={!!editing}>
              {categories.map((c) => (
                <Select.Option key={c.id} value={c.id}>{c.icon} {c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="push_date" label="推送日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="导入知识点"
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); setImportCategory(null); }}
        footer={null}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            placeholder="选择要导入到的分类"
            style={{ width: "100%" }}
            value={importCategory}
            onChange={setImportCategory}
          >
            {categories.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.icon} {c.name}</Select.Option>
            ))}
          </Select>
          <Upload
            accept=".json,.xlsx,.xls"
            beforeUpload={(f) => { handleImport(f); return false; }}
            showUploadList={false}
          >
            <Button type="primary" disabled={!importCategory}>选择文件上传</Button>
          </Upload>
          <span style={{ color: "#999", fontSize: 12 }}>支持 JSON 或 Excel，需包含 title、content、push_date 列</span>
        </Space>
      </Modal>
    </div>
  );
}
