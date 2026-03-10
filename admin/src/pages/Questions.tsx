import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Upload,
  Space,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { Category, KnowledgePoint } from "../api/client";
import { api } from "../api/client";

export interface Question {
  id: string;
  knowledge_point_id: string;
  category_id: string;
  title: string;
  options: string[];
  correct_answer: string;
}

export default function Questions() {
  const [list, setList] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();

  const loadCategories = async () => {
    const { data } = await api.get<Category[]>("/categories");
    setCategories(data);
  };

  const loadKnowledgePoints = async (categoryId?: string) => {
    const params = categoryId ? { category_id: categoryId } : {};
    const { data } = await api.get<KnowledgePoint[]>("/knowledge", { params });
    setKnowledgePoints(data);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterCategory) params.category_id = filterCategory;
      const { data } = await api.get<Question[]>("/questions", { params });
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
    loadKnowledgePoints(filterCategory ?? undefined);
  }, [filterCategory]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (typeof values.options === "string") {
      values.options = values.options.split("\n").filter((s: string) => s.trim());
    }
    try {
      if (editing) {
        await api.put(`/questions/${editing.id}`, values);
        message.success("更新成功");
      } else {
        await api.post("/questions", values);
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

  const handleEdit = (row: Question) => {
    setEditing(row);
    loadKnowledgePoints(row.category_id);
    form.setFieldsValue({
      ...row,
      options: Array.isArray(row.options) ? row.options.join("\n") : "",
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/questions/${id}`);
      message.success("删除成功");
      load();
    } catch (e) {
      message.error("删除失败");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请先选择要删除的项");
      return;
    }
    try {
      const { data } = await api.post("/questions/batch-delete", {
        ids: selectedRowKeys as string[],
      });
      message.success(`已删除 ${data.deleted} 项`);
      setSelectedRowKeys([]);
      load();
    } catch (e) {
      message.error("批量删除失败");
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
      const { data } = await api.post(`/questions/import?category_id=${importCategory}`, fd, {
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
      const { data } = await api.get(`/questions/export/${categoryId}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `questions_${categoryId}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      message.success("导出成功");
    } catch (e) {
      message.error("导出失败");
    }
  };

  return (
    <div style={{ padding: 24, background: "#fff", minHeight: "100%" }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Space align="center">
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>选择题</h2>
          <Select
            placeholder="筛选分类"
            allowClear
            style={{ width: 160 }}
            onChange={(v) => setFilterCategory(v ?? null)}
          >
            {categories.map((c) => (
              <Select.Option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </Select.Option>
            ))}
          </Select>
        </Space>
        <Space>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除
          </Button>
          <Button onClick={() => setImportModalOpen(true)}>导入</Button>
          <Button
            disabled={!filterCategory}
            onClick={() => filterCategory && handleExport(filterCategory)}
          >
            导出当前分类
          </Button>
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setModalOpen(true);
            }}
          >
            新增选择题
          </Button>
        </Space>
      </div>
      <Table
        loading={loading}
        dataSource={list}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        scroll={{ x: 700 }}
        columns={[
          { title: "题目", dataIndex: "title", ellipsis: true, width: 240 },
          {
            title: "分类",
            dataIndex: "category_id",
            width: 100,
            render: (id) => categories.find((c) => c.id === id)?.name ?? id,
          },
          {
            title: "正确答案",
            dataIndex: "correct_answer",
            width: 80,
          },
          {
            title: "操作",
            width: 140,
            render: (_, row) => (
              <>
                <Button type="link" size="small" onClick={() => handleEdit(row)}>
                  编辑
                </Button>
                <Button type="link" size="small" danger onClick={() => handleDelete(row.id)}>
                  删除
                </Button>
              </>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "编辑选择题" : "新增选择题"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="分类" rules={[{ required: true }]}>
            <Select
              placeholder="选择分类"
              disabled={!!editing}
              onChange={(v) => loadKnowledgePoints(v)}
            >
              {categories.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="knowledge_point_id" label="关联知识点" rules={[{ required: true }]}>
            <Select placeholder="选择知识点" showSearch optionFilterProp="label">
              {knowledgePoints.map((p) => (
                <Select.Option key={p.id} value={p.id} label={p.title}>
                  {p.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="题目" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="options"
            label="选项（每行一个，如 A. xxx）"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={5} placeholder="A. 选项一&#10;B. 选项二&#10;C. 选项三" />
          </Form.Item>
          <Form.Item name="correct_answer" label="正确答案（如 A 或 ABCD）" rules={[{ required: true }]}>
            <Input placeholder="A" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="导入选择题"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setImportCategory(null);
        }}
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
              <Select.Option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </Select.Option>
            ))}
          </Select>
          <Upload
            accept=".json"
            beforeUpload={(f) => {
              handleImport(f);
              return false;
            }}
            showUploadList={false}
          >
            <Button type="primary" disabled={!importCategory}>
              选择 JSON 文件上传
            </Button>
          </Upload>
          <span style={{ color: "#999", fontSize: 12 }}>
            JSON 格式：[{"{title, options, correct_answer, knowledge_point_id}"}]
          </span>
        </Space>
      </Modal>
    </div>
  );
}
