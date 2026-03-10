import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Switch, InputNumber, message, Space } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { Category } from "../api/client";
import { api } from "../api/client";

export default function Categories() {
  const [list, setList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Category[]>("/categories");
      setList(data);
    } catch (e) {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (modalOpen && editing) {
      form.setFieldsValue({
        name: editing.name,
        icon: editing.icon,
        is_free: editing.is_free,
        price: editing.price ?? undefined,
        sort_order: editing.sort_order ?? 0,
      });
    } else if (modalOpen && !editing) {
      form.resetFields();
    }
  }, [modalOpen, editing, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        icon: values.icon,
        is_free: values.is_free,
        price: values.price ?? null,
        sort_order: values.sort_order ?? 0,
      };
      if (editing) {
        await api.put(`/categories/${editing.id}`, payload);
        message.success("更新成功");
      } else {
        await api.post("/categories", payload);
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

  const handleEdit = (row: Category) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/categories/${id}`);
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
      const { data } = await api.post("/categories/batch-delete", {
        ids: selectedRowKeys as string[],
      });
      message.success(`已删除 ${data.deleted} 项`);
      setSelectedRowKeys([]);
      load();
    } catch (e) {
      message.error("批量删除失败");
    }
  };

  return (
    <div style={{ padding: 24, background: "#fff", minHeight: "100%" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>知识分类</h2>
        <Space>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除
          </Button>
          <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            新增分类
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
        columns={[
          { title: "图标", dataIndex: "icon", width: 80, render: (v) => <span style={{ fontSize: 24 }}>{v}</span> },
          { title: "名称", dataIndex: "name" },
          { title: "免费", dataIndex: "is_free", render: (v) => (v ? "是" : "否") },
          { title: "价格(分)", dataIndex: "price", width: 90, render: (v) => (v != null ? `${v / 100}元` : "-") },
          { title: "排序", dataIndex: "sort_order", width: 80 },
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
        title={editing ? "编辑分类" : "新增分类"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="icon" label="图标" initialValue="📚">
            <Input placeholder="emoji 或图标名" />
          </Form.Item>
          <Form.Item name="is_free" label="免费" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item name="price" label="价格(分)" help="付费分类填写，如390表示3.9元">
            <InputNumber min={0} placeholder="留空表示免费" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
